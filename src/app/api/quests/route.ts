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

  const { searchParams } = new URL(req.url)
  const activeOnly = searchParams.get('active') !== 'false'

  const supabase = createServiceClient()
  let query = supabase
    .from('quests')
    .select('*')
    .eq('family_id', auth.familyId)
    .order('created_at')

  if (activeOnly) query = query.eq('active', true)

  const { data, error } = await query
  if (error) return Response.json({ error: error.message }, { status: 500, headers: cors() })

  return Response.json({ quests: data }, { headers: cors() })
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
    supabase.from('quests').select('id', { count: 'exact', head: true }).eq('family_id', auth.familyId).eq('active', true),
  ])
  const plan = ((familyRes.data?.plan ?? 'free') as Plan)
  const limits = PLAN_LIMITS[plan]

  if (limits.maxQuests < Infinity && (countRes.count ?? 0) >= limits.maxQuests) {
    return Response.json({ error: `Quest limit reached for ${PLAN_LABELS[plan]} plan (max ${limits.maxQuests})` }, { status: 402, headers: cors() })
  }
  if (body.tier && body.tier !== 'normal' && !limits.questTiers) {
    return Response.json({ error: 'Quest tiers (Heroic/Epic/Legendary) require Legendary plan' }, { status: 402, headers: cors() })
  }
  if (body.active_days?.length && !limits.activeDays) {
    return Response.json({ error: 'Active day scheduling requires Legendary plan' }, { status: 402, headers: cors() })
  }

  const { data, error } = await supabase
    .from('quests')
    .insert({
      family_id: auth.familyId,
      title: body.title,
      description: body.description ?? null,
      icon: body.icon ?? '⚔️',
      coins: Number(body.coins ?? 10),
      assigned_to: body.assigned_to ?? null,
      kind: body.kind ?? 'personal',
      frequency: body.frequency ?? 'daily',
      tier: body.tier ?? 'normal',
      slots: Number(body.slots ?? 1),
      active_days: body.active_days ?? null,
      active: true,
    })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500, headers: cors() })

  return Response.json({ quest: data }, { status: 201, headers: cors() })
}
