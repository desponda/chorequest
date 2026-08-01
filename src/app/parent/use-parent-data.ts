'use client'

import { useState, useEffect, useCallback } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import type { Family, Kid, Quest, Completion, Reward, Redemption, Curse, CurseInstance, DungeonRun, DungeonClear, RaidBoss } from '@/lib/types'
import { questDateStringForZone, questWeekKeyForZone } from '@/lib/utils'

export interface ParentData {
  family: Family | null
  kids: Kid[]
  quests: Quest[]
  completions: Completion[]
  rewards: Reward[]
  redemptions: Redemption[]
  curses: Curse[]
  activeCurseInstances: CurseInstance[]
  resolvedCurseInstances: CurseInstance[]
  activeDungeon: DungeonRun | null
  dungeonClears: DungeonClear[]
  weeklyCompletions: Completion[]
  activeBoss: RaidBoss | null
  pastDungeons: DungeonRun[]
  defeatedBosses: RaidBoss[]
  loading: boolean
  supabase: SupabaseClient
  refetch: () => Promise<void>
}

const KID_COLS = 'id, name, avatar, color, coins, streak, last_completed_date, xp, level, family_id, created_at'

export function useParentData(): ParentData {
  const [supabase] = useState(createClient)
  const [family, setFamily] = useState<Family | null>(null)
  const [kids, setKids] = useState<Kid[]>([])
  const [quests, setQuests] = useState<Quest[]>([])
  const [completions, setCompletions] = useState<Completion[]>([])
  const [rewards, setRewards] = useState<Reward[]>([])
  const [redemptions, setRedemptions] = useState<Redemption[]>([])
  const [curses, setCurses] = useState<Curse[]>([])
  const [activeCurseInstances, setActiveCurseInstances] = useState<CurseInstance[]>([])
  const [resolvedCurseInstances, setResolvedCurseInstances] = useState<CurseInstance[]>([])
  const [activeDungeon, setActiveDungeon] = useState<DungeonRun | null>(null)
  const [dungeonClears, setDungeonClears] = useState<DungeonClear[]>([])
  const [weeklyCompletions, setWeeklyCompletions] = useState<Completion[]>([])
  const [activeBoss, setActiveBoss] = useState<RaidBoss | null>(null)
  const [pastDungeons, setPastDungeons] = useState<DungeonRun[]>([])
  const [defeatedBosses, setDefeatedBosses] = useState<RaidBoss[]>([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    const { data: profile } = await supabase.from('profiles').select('family_id').single()
    if (!profile) return

    const { data: resetData } = await supabase
      .from('families')
      .select('daily_reset_hour, timezone')
      .eq('id', profile.family_id)
      .single()
    const resetHour = resetData?.daily_reset_hour ?? 0
    const detectedTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    const timeZone = resetData?.timezone ?? detectedTimeZone
    if (!resetData?.timezone) {
      await supabase.from('families').update({ timezone: detectedTimeZone }).eq('id', profile.family_id).is('timezone', null)
    }
    const today = questDateStringForZone(resetHour, timeZone)
    const weekStart = questWeekKeyForZone(resetHour, timeZone)

    const [
      familyRes, kidsRes, questsRes, pendingCompletionsRes, reviewedTodayRes, rewardsRes,
      pendingRedemptionsRes, approvedRedemptionsRes, cursesRes, curseInstancesRes, resolvedCurseInstancesRes,
      activeDungeonRes, activeBossRes, pastDungeonsRes, defeatedBossesRes, weeklyCompletionsRes,
    ] = await Promise.all([
      supabase.from('families').select('id, name, invite_token, api_key, daily_reset_hour, timezone, created_at, parent_pin, plan').eq('id', profile.family_id).single(),
      supabase.from('kids').select(KID_COLS).eq('family_id', profile.family_id).order('created_at'),
      supabase.from('quests').select('*').eq('family_id', profile.family_id).eq('archived', false).order('created_at'),
      // pending completions: no date filter — yesterday's unapproved items must surface
      supabase.from('completions').select(`*, quest:quests(*), kid:kids(${KID_COLS})`).eq('status', 'pending').order('completed_at', { ascending: false }),
      // reviewed completions: no date filter — show full history
      supabase.from('completions').select(`*, quest:quests(*), kid:kids(${KID_COLS})`).in('status', ['approved', 'rejected']).order('completed_at', { ascending: false }).limit(200),
      supabase.from('rewards').select('*').eq('family_id', profile.family_id).eq('archived', false).order('created_at'),
      supabase.from('redemptions').select(`*, reward:rewards(*), kid:kids(${KID_COLS})`).eq('status', 'pending').order('redeemed_at', { ascending: false }),
      supabase.from('redemptions').select(`*, reward:rewards(*), kid:kids(${KID_COLS})`).in('status', ['approved', 'denied']).order('processed_at', { ascending: false }).limit(200),
      supabase.from('curses').select('*').eq('family_id', profile.family_id).eq('archived', false).order('created_at'),
      supabase.from('curse_instances').select(`*, curse:curses(*), kid:kids(${KID_COLS})`).eq('status', 'active').order('cast_at', { ascending: false }),
      supabase.from('curse_instances').select(`*, curse:curses(*), kid:kids(${KID_COLS})`).eq('status', 'resolved').order('resolved_at', { ascending: false }).limit(200),
      supabase.from('dungeon_runs').select('*').eq('family_id', profile.family_id).eq('week_start', weekStart).eq('archived', false).maybeSingle(),
      supabase.from('raid_bosses').select('*').eq('family_id', profile.family_id).eq('status', 'active').eq('archived', false).maybeSingle(),
      supabase.from('dungeon_runs').select('*').eq('family_id', profile.family_id).eq('archived', false).lt('week_start', weekStart).order('week_start', { ascending: false }).limit(5),
      supabase.from('raid_bosses').select('*').eq('family_id', profile.family_id).eq('status', 'defeated').eq('archived', false).order('defeated_at', { ascending: false }).limit(5),
      supabase.from('completions').select('kid_id, coins_awarded, status').eq('status', 'approved').gte('date', weekStart).lte('date', today),
    ])

    if (familyRes.data) {
      const { parent_pin, ...rest } = familyRes.data
      setFamily({
        ...rest,
        has_parent_pin: parent_pin !== null,
        api_key: rest.api_key ?? undefined,
        daily_reset_hour: rest.daily_reset_hour ?? 0,
        timezone: rest.timezone ?? timeZone,
        plan: (rest.plan as import('@/lib/types').Plan) ?? 'free',
      })
    }
    if (kidsRes.data) setKids(kidsRes.data as Kid[])
    if (questsRes.data) setQuests(questsRes.data as Quest[])
    setCompletions([
      ...((pendingCompletionsRes.data ?? []) as Completion[]),
      ...((reviewedTodayRes.data ?? []) as Completion[]),
    ])
    if (rewardsRes.data) setRewards(rewardsRes.data as Reward[])
    setRedemptions([
      ...((pendingRedemptionsRes.data ?? []) as Redemption[]),
      ...((approvedRedemptionsRes.data ?? []) as Redemption[]),
    ])
    if (cursesRes.data) setCurses(cursesRes.data as Curse[])
    if (curseInstancesRes.data) setActiveCurseInstances(curseInstancesRes.data as CurseInstance[])
    if (resolvedCurseInstancesRes.data) setResolvedCurseInstances(resolvedCurseInstancesRes.data as CurseInstance[])

    const dungeon = (activeDungeonRes.data as DungeonRun) ?? null
    setActiveDungeon(dungeon)
    if (dungeon) {
      const { data: clears } = await supabase
        .from('dungeon_clears').select('*').eq('dungeon_run_id', dungeon.id)
      setDungeonClears((clears ?? []) as DungeonClear[])
    } else {
      setDungeonClears([])
    }

    setActiveBoss((activeBossRes.data as RaidBoss) ?? null)
    setPastDungeons((pastDungeonsRes.data ?? []) as DungeonRun[])
    setDefeatedBosses((defeatedBossesRes.data ?? []) as RaidBoss[])
    setWeeklyCompletions((weeklyCompletionsRes.data ?? []) as Completion[])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    refetch()
    const channel = supabase
      .channel('parent-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'completions' }, refetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'redemptions' }, refetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'curse_instances' }, refetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dungeon_runs' }, refetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dungeon_clears' }, refetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'raid_bosses' }, refetch)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [refetch, supabase])

  return {
    family, kids, quests, completions, rewards, redemptions, curses, activeCurseInstances, resolvedCurseInstances,
    activeDungeon, dungeonClears, weeklyCompletions,
    activeBoss, pastDungeons, defeatedBosses,
    loading, supabase, refetch,
  }
}
