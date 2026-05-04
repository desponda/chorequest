import { authenticate, isAuthError, cors } from '@/lib/api-auth'
import { createServiceClient } from '@/lib/supabase/service'
import type { Plan } from '@/lib/types'
import { PLAN_LIMITS, PLAN_LABELS } from '@/lib/plans'

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
    .order('created_at')

  if (error) return Response.json({ error: error.message }, { status: 500, headers: cors() })

  return Response.json({ rewards: data }, { headers: cors() })
}

export async function POST(req: Request) {
  const auth = await authenticate(req)
  if (isAuthError(auth)) return auth

  const body = await req.json().catch(() => null)
  if (!body?.title) {
    return Response.json({ error: '`title` is required' }, { status: 400, headers: cors() })
  }

  const supabase = createServiceClient()

  const [familyRes, countRes] = await Promise.all([
    supabase.from('families').select('plan').eq('id', auth.familyId).single(),
    supabase.from('rewards').select('id', { count: 'exact', head: true }).eq('family_id', auth.familyId),
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
      title: body.title,
      description: body.description ?? null,
      icon: body.icon ?? '🎁',
      cost: Number(body.cost ?? 50),
      available: true,
    })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500, headers: cors() })

  return Response.json({ reward: data }, { status: 201, headers: cors() })
}
