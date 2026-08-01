import { authenticate, isAuthError, cors } from '@/lib/api-auth'
import { createServiceClient } from '@/lib/supabase/service'
import type { Plan } from '@/lib/types'
import { PLAN_LIMITS, PLAN_LABELS } from '@/lib/plans'
import { boundedInteger, nonEmptyString } from '@/lib/validation'

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: cors() })
}

export async function GET(req: Request) {
  const auth = await authenticate(req)
  if (isAuthError(auth)) return auth

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('rewards')
    .select('*')
    .eq('family_id', auth.familyId)
    .eq('archived', false)
    .order('created_at')

  if (error) return Response.json({ error: error.message }, { status: 500, headers: cors() })

  return Response.json({ rewards: data }, { headers: cors() })
}

export async function POST(req: Request) {
  const auth = await authenticate(req)
  if (isAuthError(auth)) return auth

  const body = await req.json().catch(() => null)
  const title = nonEmptyString(body?.title)
  const icon = body?.icon === undefined ? '🎁' : nonEmptyString(body.icon)
  const cost = boundedInteger(body?.cost, { defaultValue: 50, min: 1, max: 1_000_000 })
  if (!title) {
    return Response.json({ error: '`title` is required' }, { status: 400, headers: cors() })
  }
  if (!icon || (body.description !== undefined && body.description !== null && typeof body.description !== 'string')) {
    return Response.json({ error: '`icon` must be non-empty and `description` must be text or null' }, { status: 400, headers: cors() })
  }
  if (cost === null) return Response.json({ error: '`cost` must be a positive integer' }, { status: 400, headers: cors() })

  const supabase = createServiceClient()

  const [familyRes, countRes] = await Promise.all([
    supabase.from('families').select('plan').eq('id', auth.familyId).single(),
    supabase.from('rewards').select('id', { count: 'exact', head: true }).eq('family_id', auth.familyId).eq('archived', false),
  ])
  const plan = ((familyRes.data?.plan ?? 'free') as Plan)
  const limits = PLAN_LIMITS[plan]

  if (limits.maxRewards < Infinity && (countRes.count ?? 0) >= limits.maxRewards) {
    return Response.json({ error: `Reward limit reached for ${PLAN_LABELS[plan]} plan (max ${limits.maxRewards})` }, { status: 402, headers: cors() })
  }

  const { data, error } = await supabase
    .from('rewards')
    .insert({
      family_id: auth.familyId,
      title,
      description: body.description ?? null,
      icon,
      cost,
      available: true,
      archived: false,
    })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500, headers: cors() })

  return Response.json({ reward: data }, { status: 201, headers: cors() })
}
