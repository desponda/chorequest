import { createServiceClient } from '@/lib/supabase/service'
import { questDateString, questWeekKey } from '@/lib/utils'
import { NextRequest } from 'next/server'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServiceClient()

  const { data: kid } = await supabase
    .from('kids')
    .select('id, name, avatar, color, coins, streak, last_completed_date, family_id, created_at')
    .eq('id', id)
    .single()

  if (!kid) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  const [familyRes, questsRes, rewardsRes] = await Promise.all([
    supabase.from('families').select('daily_reset_hour').eq('id', kid.family_id).single(),
    supabase.from('quests').select('*').eq('active', true).eq('family_id', kid.family_id).order('created_at'),
    supabase.from('rewards').select('*').eq('available', true).eq('family_id', kid.family_id),
  ])

  const resetHour = familyRes.data?.daily_reset_hour ?? 0
  const today = questDateString(resetHour)
  const weekStart = questWeekKey(resetHour)

  const bountyQuestIds = (questsRes.data ?? [])
    .filter((q) => q.weekly_target != null && q.exclusive)
    .map((q: { id: string }) => q.id)

  const exclusiveQuestIds = (questsRes.data ?? [])
    .filter((q) => q.exclusive && !(q.weekly_target != null && q.exclusive))
    .map((q: { id: string }) => q.id)

  const [completionsRes, cursesRes, exclusiveClaimedRes, familyBountyRes] = await Promise.all([
    supabase.from('completions').select('*').eq('kid_id', id).gte('date', weekStart),
    supabase.from('curse_instances').select('*, curse:curses(*)').eq('kid_id', id).eq('status', 'active'),
    exclusiveQuestIds.length > 0
      ? supabase.from('completions').select('quest_id').in('quest_id', exclusiveQuestIds).eq('date', today).neq('kid_id', id)
      : Promise.resolve({ data: [] }),
    bountyQuestIds.length > 0
      ? supabase.from('completions').select('quest_id, kid_id, status').in('quest_id', bountyQuestIds).gte('date', weekStart)
      : Promise.resolve({ data: [] }),
  ])

  return Response.json({
    kid,
    resetHour,
    quests: questsRes.data ?? [],
    completions: completionsRes.data ?? [],
    rewards: rewardsRes.data ?? [],
    activeCurses: cursesRes.data ?? [],
    claimedExclusiveIds: (exclusiveClaimedRes.data ?? []).map((c: { quest_id: string }) => c.quest_id),
    familyBountyCompletions: familyBountyRes.data ?? [],
  })
}
