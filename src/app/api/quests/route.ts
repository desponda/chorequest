import { authenticate, isAuthError, cors } from '@/lib/api-auth'
import { createServiceClient } from '@/lib/supabase/service'
import type { Plan } from '@/lib/types'
import { PLAN_LIMITS, PLAN_LABELS } from '@/lib/plans'
import { boundedInteger, nonEmptyString } from '@/lib/validation'
import type { QuestFrequency, QuestKind, QuestTier } from '@/lib/types'

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
    .eq('archived', false)
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
  const title = nonEmptyString(body?.title)
  const icon = body?.icon === undefined ? '⚔️' : nonEmptyString(body.icon)
  const coins = boundedInteger(body?.coins, { defaultValue: 10, min: 0, max: 1_000_000 })
  const slots = boundedInteger(body?.slots, { defaultValue: 1, min: 1, max: 100 })
  const validKinds: QuestKind[] = ['personal', 'shared', 'oneoff']
  const validFrequencies: QuestFrequency[] = ['daily', 'weekly', 'once']
  const validTiers: QuestTier[] = ['normal', 'rare', 'epic', 'legendary']
  const kind = (body?.kind ?? 'personal') as QuestKind
  const frequency = (body?.frequency ?? (kind === 'oneoff' ? 'once' : 'daily')) as QuestFrequency
  const tier = (body?.tier ?? 'normal') as QuestTier
  const activeDays = body?.active_days ?? null

  if (!title) {
    return Response.json({ error: '`title` is required' }, { status: 400, headers: cors() })
  }
  if (!icon || (body.description !== undefined && body.description !== null && typeof body.description !== 'string')) {
    return Response.json({ error: '`icon` must be non-empty and `description` must be text or null' }, { status: 400, headers: cors() })
  }
  if (coins === null || slots === null || !validKinds.includes(kind) || !validFrequencies.includes(frequency) || !validTiers.includes(tier)) {
    return Response.json({ error: 'Invalid quest fields' }, { status: 400, headers: cors() })
  }
  if ((kind === 'oneoff') !== (frequency === 'once')) {
    return Response.json({ error: 'One-time frequency and kind must be used together' }, { status: 400, headers: cors() })
  }
  if (activeDays !== null && (!Array.isArray(activeDays) || activeDays.some((day) => !Number.isInteger(day) || day < 0 || day > 6))) {
    return Response.json({ error: '`active_days` must contain weekdays 0 through 6' }, { status: 400, headers: cors() })
  }
  if (body.assigned_to !== undefined && body.assigned_to !== null && typeof body.assigned_to !== 'string') {
    return Response.json({ error: '`assigned_to` must be a kid ID or null' }, { status: 400, headers: cors() })
  }

  const supabase = createServiceClient()

  const [familyRes, countRes] = await Promise.all([
    supabase.from('families').select('plan').eq('id', auth.familyId).single(),
    supabase.from('quests').select('id', { count: 'exact', head: true }).eq('family_id', auth.familyId).eq('active', true).eq('archived', false),
  ])
  const plan = ((familyRes.data?.plan ?? 'free') as Plan)
  const limits = PLAN_LIMITS[plan]

  if (limits.maxQuests < Infinity && (countRes.count ?? 0) >= limits.maxQuests) {
    return Response.json({ error: `Quest limit reached for ${PLAN_LABELS[plan]} plan (max ${limits.maxQuests})` }, { status: 402, headers: cors() })
  }
  if (tier !== 'normal' && !limits.questTiers) {
    return Response.json({ error: 'Quest tiers (Heroic/Epic/Legendary) require Legendary plan' }, { status: 402, headers: cors() })
  }
  if (activeDays?.length && !limits.activeDays) {
    return Response.json({ error: 'Active day scheduling requires Legendary plan' }, { status: 402, headers: cors() })
  }

  if (body.assigned_to) {
    const { data: assignee } = await supabase
      .from('kids')
      .select('id')
      .eq('id', body.assigned_to)
      .eq('family_id', auth.familyId)
      .maybeSingle()
    if (!assignee) return Response.json({ error: 'Assigned kid not found' }, { status: 400, headers: cors() })
  }

  const { data, error } = await supabase
    .from('quests')
    .insert({
      family_id: auth.familyId,
      title,
      description: body.description ?? null,
      icon,
      coins,
      assigned_to: body.assigned_to ?? null,
      kind,
      frequency,
      tier,
      slots: kind === 'shared' ? slots : 1,
      active_days: activeDays?.length ? [...new Set(activeDays)] : null,
      active: true,
      archived: false,
    })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500, headers: cors() })

  return Response.json({ quest: data }, { status: 201, headers: cors() })
}
