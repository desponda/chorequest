'use client'

import { useState, useEffect, useCallback } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import type { Family, Kid, Quest, Completion, Reward, Redemption, Curse, CurseInstance } from '@/lib/types'
import { questDateString } from '@/lib/utils'

export interface ParentData {
  family: Family | null
  kids: Kid[]
  quests: Quest[]
  completions: Completion[]
  rewards: Reward[]
  redemptions: Redemption[]
  curses: Curse[]
  activeCurseInstances: CurseInstance[]
  loading: boolean
  supabase: SupabaseClient
  refetch: () => Promise<void>
}

const KID_COLS = 'id, name, avatar, color, coins, streak, last_completed_date, family_id, created_at'

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
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    const { data: profile } = await supabase.from('profiles').select('family_id').single()
    if (!profile) return

    const { data: resetData } = await supabase
      .from('families')
      .select('daily_reset_hour')
      .eq('id', profile.family_id)
      .single()
    const today = questDateString(resetData?.daily_reset_hour ?? 0)

    const [
      familyRes, kidsRes, questsRes, completionsRes, rewardsRes,
      pendingRedemptionsRes, approvedRedemptionsRes, cursesRes, curseInstancesRes,
    ] = await Promise.all([
      supabase.from('families').select('id, name, invite_token, api_key, daily_reset_hour, created_at, parent_pin, plan').eq('id', profile.family_id).single(),
      supabase.from('kids').select(KID_COLS).eq('family_id', profile.family_id).order('created_at'),
      supabase.from('quests').select('*').eq('family_id', profile.family_id).order('created_at'),
      supabase.from('completions').select(`*, quest:quests(*), kid:kids(${KID_COLS})`).eq('date', today).order('completed_at', { ascending: false }),
      supabase.from('rewards').select('*').eq('family_id', profile.family_id).order('created_at'),
      supabase.from('redemptions').select(`*, reward:rewards(*), kid:kids(${KID_COLS})`).eq('status', 'pending').order('redeemed_at', { ascending: false }),
      supabase.from('redemptions').select(`*, reward:rewards(*), kid:kids(${KID_COLS})`).eq('status', 'approved').gte('redeemed_at', today).order('redeemed_at', { ascending: false }),
      supabase.from('curses').select('*').eq('family_id', profile.family_id).order('created_at'),
      supabase.from('curse_instances').select(`*, curse:curses(*), kid:kids(${KID_COLS})`).eq('status', 'active').order('cast_at', { ascending: false }),
    ])

    if (familyRes.data) {
      const { parent_pin, ...rest } = familyRes.data
      setFamily({
        ...rest,
        has_parent_pin: parent_pin !== null,
        api_key: rest.api_key ?? undefined,
        daily_reset_hour: rest.daily_reset_hour ?? 0,
        plan: (rest.plan as import('@/lib/types').Plan) ?? 'free',
      })
    }
    if (kidsRes.data) setKids(kidsRes.data as Kid[])
    if (questsRes.data) setQuests(questsRes.data as Quest[])
    if (completionsRes.data) setCompletions(completionsRes.data as Completion[])
    if (rewardsRes.data) setRewards(rewardsRes.data as Reward[])
    setRedemptions([
      ...((pendingRedemptionsRes.data ?? []) as Redemption[]),
      ...((approvedRedemptionsRes.data ?? []) as Redemption[]),
    ])
    if (cursesRes.data) setCurses(cursesRes.data as Curse[])
    if (curseInstancesRes.data) setActiveCurseInstances(curseInstancesRes.data as CurseInstance[])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    refetch()
    const channel = supabase
      .channel('parent-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'completions' }, refetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'redemptions' }, refetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'curse_instances' }, refetch)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [refetch, supabase])

  return { family, kids, quests, completions, rewards, redemptions, curses, activeCurseInstances, loading, supabase, refetch }
}
