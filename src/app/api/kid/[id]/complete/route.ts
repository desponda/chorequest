import { createServiceClient } from '@/lib/supabase/service'
import { canKidSubmitQuest } from '@/lib/quest-submission'
import type { Quest } from '@/lib/types'
import { isDateKey, questDateStringForZone } from '@/lib/utils'
import { requireKidSession } from '@/lib/kid-session'
import { NextRequest } from 'next/server'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const authError = requireKidSession(req, id)
  if (authError) return authError

  const body = await req.json().catch(() => null)
  if (!body?.quest_id || typeof body.quest_id !== 'string' || !isDateKey(body?.date)) {
    return Response.json({ error: 'Invalid request' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { data: kid, error: kidError } = await supabase
    .from('kids')
    .select('id, family_id')
    .eq('id', id)
    .single()
  if (!kid) return Response.json({ error: 'Not found' }, { status: 404 })

  const [questResult, familyResult] = await Promise.all([
    supabase
      .from('quests')
      .select('id, family_id, assigned_to, kind, frequency, slots, active, active_days')
      .eq('id', body.quest_id)
      .eq('archived', false)
      .single(),
    supabase
      .from('families')
      .select('daily_reset_hour, timezone')
      .eq('id', kid.family_id)
      .single(),
  ])
  const { data: questData, error: questError } = questResult

  if (kidError || questError || !questData) {
    return Response.json({ error: 'Quest not found' }, { status: 404 })
  }
  if (familyResult.error || !familyResult.data) {
    return Response.json({ error: 'Could not validate the quest date' }, { status: 500 })
  }

  let expectedDate: string
  try {
    expectedDate = questDateStringForZone(
      familyResult.data.daily_reset_hour ?? 0,
      familyResult.data.timezone ?? 'UTC',
    )
  } catch {
    return Response.json({ error: 'Family timezone is invalid' }, { status: 500 })
  }
  if (body.date !== expectedDate) {
    return Response.json({ error: 'Quest date is stale or invalid; refresh and try again' }, { status: 409 })
  }

  const quest = questData as Pick<Quest, 'active' | 'active_days' | 'assigned_to' | 'family_id' | 'frequency' | 'kind' | 'slots'>
  if (!canKidSubmitQuest(quest, kid, body.date)) {
    return Response.json({ error: 'Quest is not available to this kid' }, { status: 409 })
  }

  const { data: submission, error } = await supabase.rpc('submit_quest', {
    p_kid_id: id,
    p_quest_id: body.quest_id,
    p_date: body.date,
  })
  if (error) return Response.json({ error: error.message }, { status: 500 })

  const result = submission as { success?: boolean; retried?: boolean; reason?: string } | null
  if (!result?.success) {
    const message = result?.reason === 'slots_full' ? 'All slots are already claimed'
      : result?.reason === 'already_submitted' ? 'Already submitted'
      : result?.reason === 'stale_date' ? 'Quest date is stale or invalid; refresh and try again'
      : 'Quest is not available to this kid'
    return Response.json({ error: message }, { status: result?.reason === 'not_found' ? 404 : 409 })
  }

  return Response.json({ success: true, retried: result.retried === true })
}
