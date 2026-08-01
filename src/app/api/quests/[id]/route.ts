import { authenticate, isAuthError, cors } from '@/lib/api-auth'
import { createServiceClient } from '@/lib/supabase/service'
import { PLAN_LIMITS } from '@/lib/plans'
import type { Plan, QuestFrequency, QuestKind, QuestTier } from '@/lib/types'
import { boundedInteger, nonEmptyString } from '@/lib/validation'

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: cors() })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticate(req)
  if (isAuthError(auth)) return auth

  const { id } = await params
  const parsed = await req.json().catch(() => null)
  const body: Record<string, unknown> = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}

  const updates: Record<string, unknown> = {}
  if ('title' in body) {
    const title = nonEmptyString(body.title)
    if (!title) return Response.json({ error: '`title` cannot be blank' }, { status: 400, headers: cors() })
    updates.title = title
  }
  if ('description' in body) {
    if (body.description !== null && typeof body.description !== 'string') return Response.json({ error: '`description` must be text or null' }, { status: 400, headers: cors() })
    updates.description = body.description
  }
  if ('icon' in body) {
    const icon = nonEmptyString(body.icon)
    if (!icon) return Response.json({ error: '`icon` must be non-empty text' }, { status: 400, headers: cors() })
    updates.icon = icon
  }
  if ('coins' in body) {
    const coins = boundedInteger(body.coins, { min: 0, max: 1_000_000 })
    if (coins === null) return Response.json({ error: '`coins` must be a non-negative integer' }, { status: 400, headers: cors() })
    updates.coins = coins
  }
  if ('slots' in body) {
    const slots = boundedInteger(body.slots, { min: 1, max: 100 })
    if (slots === null) return Response.json({ error: '`slots` must be between 1 and 100' }, { status: 400, headers: cors() })
    updates.slots = slots
  }
  const validKinds: QuestKind[] = ['personal', 'shared', 'oneoff']
  const validFrequencies: QuestFrequency[] = ['daily', 'weekly', 'once']
  const validTiers: QuestTier[] = ['normal', 'rare', 'epic', 'legendary']
  if ('kind' in body) {
    if (typeof body.kind !== 'string' || !validKinds.includes(body.kind as QuestKind)) return Response.json({ error: 'Invalid quest kind' }, { status: 400, headers: cors() })
    updates.kind = body.kind
  }
  if ('frequency' in body) {
    if (typeof body.frequency !== 'string' || !validFrequencies.includes(body.frequency as QuestFrequency)) return Response.json({ error: 'Invalid quest frequency' }, { status: 400, headers: cors() })
    updates.frequency = body.frequency
  }
  if ('tier' in body) {
    if (typeof body.tier !== 'string' || !validTiers.includes(body.tier as QuestTier)) return Response.json({ error: 'Invalid quest tier' }, { status: 400, headers: cors() })
    updates.tier = body.tier
  }
  if ('assigned_to' in body) {
    if (body.assigned_to !== null && typeof body.assigned_to !== 'string') {
      return Response.json({ error: '`assigned_to` must be a kid ID or null' }, { status: 400, headers: cors() })
    }
    updates.assigned_to = body.assigned_to
  }
  if ('active_days' in body) {
    if (body.active_days !== null && (!Array.isArray(body.active_days) || body.active_days.some((day: unknown) => !Number.isInteger(day) || (day as number) < 0 || (day as number) > 6))) {
      return Response.json({ error: '`active_days` must contain weekdays 0 through 6' }, { status: 400, headers: cors() })
    }
    updates.active_days = body.active_days?.length ? [...new Set(body.active_days)] : null
  }
  if ('active' in body) {
    if (typeof body.active !== 'boolean') return Response.json({ error: '`active` must be boolean' }, { status: 400, headers: cors() })
    updates.active = body.active
  }

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: 'No valid fields to update' }, { status: 400, headers: cors() })
  }

  const supabase = createServiceClient()
  const [currentRes, familyRes] = await Promise.all([
    supabase.from('quests').select('kind, frequency').eq('id', id).eq('family_id', auth.familyId).eq('archived', false).maybeSingle(),
    supabase.from('families').select('plan').eq('id', auth.familyId).single(),
  ])
  if (!currentRes.data) return Response.json({ error: 'Quest not found' }, { status: 404, headers: cors() })

  const plan = (familyRes.data?.plan ?? 'free') as Plan
  const limits = PLAN_LIMITS[plan]
  if (updates.tier && updates.tier !== 'normal' && !limits.questTiers) {
    return Response.json({ error: 'Quest tiers require Legendary plan' }, { status: 402, headers: cors() })
  }
  if (Array.isArray(updates.active_days) && updates.active_days.length > 0 && !limits.activeDays) {
    return Response.json({ error: 'Active day scheduling requires Legendary plan' }, { status: 402, headers: cors() })
  }
  if (updates.assigned_to) {
    const { data: assignee } = await supabase.from('kids').select('id').eq('id', updates.assigned_to).eq('family_id', auth.familyId).maybeSingle()
    if (!assignee) return Response.json({ error: 'Assigned kid not found' }, { status: 400, headers: cors() })
  }

  const resultingKind = (updates.kind ?? currentRes.data.kind) as QuestKind
  const resultingFrequency = (updates.frequency ?? currentRes.data.frequency) as QuestFrequency
  if ((resultingKind === 'oneoff') !== (resultingFrequency === 'once')) {
    return Response.json({ error: 'One-time frequency and kind must be used together' }, { status: 400, headers: cors() })
  }
  if (resultingKind !== 'shared') updates.slots = 1

  const { data, error } = await supabase
    .from('quests')
    .update(updates)
    .eq('id', id)
    .eq('family_id', auth.familyId)
    .eq('archived', false)
    .select()
    .single()

  if (error || !data) {
    return Response.json({ error: error?.message ?? 'Quest not found' }, { status: error ? 500 : 404, headers: cors() })
  }

  return Response.json({ quest: data }, { headers: cors() })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticate(req)
  if (isAuthError(auth)) return auth

  const { id } = await params
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('quests')
    .update({ archived: true, active: false })
    .eq('id', id)
    .eq('family_id', auth.familyId)
    .eq('archived', false)
    .select('id')
    .maybeSingle()

  if (error) return Response.json({ error: error.message }, { status: 500, headers: cors() })
  if (!data) return Response.json({ error: 'Quest not found' }, { status: 404, headers: cors() })

  return Response.json({ deleted: true }, { headers: cors() })
}
