import { createServiceClient } from '@/lib/supabase/service'
import { questWeekKey } from '@/lib/utils'
import type { Quest } from '@/lib/types'
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
  const weekStart = questWeekKey(resetHour)

  const allQuests: Quest[] = (questsRes.data ?? []) as Quest[]
  const sharedQuestIds = allQuests.filter((q) => q.kind === 'shared' || q.kind === 'oneoff').map((q) => q.id)

  const [completionsRes, cursesRes, sharedFamilyRes, pendingRedemptionsRes] = await Promise.all([
    supabase.from('completions').select('*').eq('kid_id', id).gte('date', weekStart),
    supabase.from('curse_instances').select('*, curse:curses(*)').eq('kid_id', id).eq('status', 'active'),
    sharedQuestIds.length > 0
      ? supabase.from('completions').select('quest_id, kid_id, status, date').in('quest_id', sharedQuestIds).gte('date', weekStart)
      : Promise.resolve({ data: [] }),
    supabase
      .from('redemptions')
      .select('id, reward_id, status, redeemed_at, reward:rewards(id, title, icon, cost)')
      .eq('kid_id', id)
      .eq('status', 'pending'),
  ])

  return Response.json({
    kid,
    resetHour,
    quests: allQuests,
    completions: completionsRes.data ?? [],
    rewards: rewardsRes.data ?? [],
    activeCurses: cursesRes.data ?? [],
    familySharedCompletions: sharedFamilyRes.data ?? [],
    pendingRedemptions: pendingRedemptionsRes.data ?? [],
  })
}
