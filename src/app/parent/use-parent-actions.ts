'use client'

import { useCallback } from 'react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Family, Kid, Quest, QuestKind, QuestFrequency, QuestTier, Completion, Reward, Redemption, Curse, CurseInstance } from '@/lib/types'
import { DEFAULT_QUESTS } from '@/lib/constants'
import { PLAN_LIMITS, PLAN_LABELS, PLAN_UPGRADE_HINT } from '@/lib/plans'
import { questDateString } from '@/lib/utils'
import { yesterday } from './_streak'
import { getLevelFromXP, getWeekMonday } from '@/lib/xp'
import type { DungeonRun, DungeonClear, RaidBoss } from '@/lib/types'

interface Deps {
  supabase: SupabaseClient
  family: Family | null
  completions: Completion[]
  redemptions: Redemption[]
  kids: Kid[]
  quests: Quest[]
  rewards: Reward[]
  curses: Curse[]
  activeCurseInstances: CurseInstance[]
  resolvedCurseInstances: CurseInstance[]
  activeDungeon: DungeonRun | null
  dungeonClears: DungeonClear[]
  activeBoss: RaidBoss | null
  refetch: () => Promise<void>
}

export interface ParentActions {
  approve: (completionId: string) => Promise<void>
  reject: (completionId: string) => Promise<void>
  undoApproval: (completionId: string) => Promise<void>
  undoRejection: (completionId: string) => Promise<void>
  fulfillRedemption: (redemptionId: string) => Promise<void>
  denyRedemption: (redemptionId: string) => Promise<void>
  undoRedemption: (redemptionId: string) => Promise<void>
  undoResolvedCurse: (instanceId: string) => Promise<void>
  addKid: (data: { name: string; avatar: string; color: 'azure' | 'mystic'; pin: string }) => Promise<void>
  addQuest: (data: AddQuestInput) => Promise<void>
  toggleQuest: (id: string, active: boolean) => Promise<void>
  deleteQuest: (id: string) => Promise<void>
  saveQuest: (id: string, updates: Partial<Quest>) => Promise<void>
  seedDefaultQuests: () => Promise<void>
  addReward: (data: { title: string; description: string; icon: string; cost: number }) => Promise<void>
  deleteReward: (id: string) => Promise<void>
  saveReward: (id: string, updates: { title: string; description: string; icon: string; cost: number }) => Promise<void>
  saveResetHour: (hour: number) => Promise<void>
  saveFamilyName: (name: string) => Promise<void>
  saveCoins: (kidId: string, value: number) => Promise<void>
  setParentPin: (pin: string) => Promise<void>
  removeParentPin: () => Promise<void>
  regenerateApiKey: () => Promise<void>
  regenerateInviteToken: () => Promise<void>
  addCurse: (data: { title: string; icon: string; penalty: number }) => Promise<void>
  deleteCurse: (id: string) => Promise<void>
  castCurse: (curseId: string, kidId: string) => Promise<void>
  castAdHocCurse: (data: { title: string; icon: string; penalty: number; kidId: string }) => Promise<void>
  resolveCurse: (instanceId: string, refund: boolean) => Promise<void>
  addDungeonRun: (data: { title: string; icon: string; hp: number; rewardCoins: number; rewardXp: number }) => Promise<void>
  deleteDungeonRun: (id: string) => Promise<void>
  addRaidBoss: (data: { title: string; icon: string; hpPerKid: number; bountyCoins: number }) => Promise<void>
  deleteRaidBoss: (id: string) => Promise<void>
  signOut: () => Promise<void>
}

export interface AddQuestInput {
  title: string
  description: string
  icon: string
  coins: number
  assignedTo: string | null
  kind: QuestKind
  frequency: QuestFrequency
  tier: QuestTier
  slots: number
  activeDays: number[]
}

export function useParentActions(deps: Deps): ParentActions {
  const { supabase, family, completions, redemptions, kids, quests, rewards, curses, activeCurseInstances, resolvedCurseInstances, activeDungeon, dungeonClears, activeBoss, refetch } = deps
  const router = useRouter()

  const approve = useCallback(async (completionId: string) => {
    const completion = completions.find((c) => c.id === completionId)
    if (!completion) return

    const coinsAwarded = completion.quest?.coins ?? 0

    const { data: updated, error } = await supabase
      .from('completions')
      .update({ status: 'approved', approved_at: new Date().toISOString(), coins_awarded: coinsAwarded })
      .eq('id', completionId)
      .eq('status', 'pending')
      .select('id')

    if (error || !updated || updated.length === 0) {
      toast.error('Quest was already undone — nothing to approve')
      await refetch()
      return
    }

    // Award coins + XP to the completing kid
    const { data: freshKid } = await supabase
      .from('kids')
      .select('coins, xp, level, streak, last_completed_date')
      .eq('id', completion.kid_id)
      .single()

    const newXP = (freshKid?.xp ?? 0) + coinsAwarded
    const newLevel = getLevelFromXP(newXP)
    const today = questDateString(family?.daily_reset_hour ?? 0)
    const newStreak = freshKid?.last_completed_date === yesterday() ? (freshKid?.streak ?? 0) + 1 : 1

    await supabase.from('kids').update({
      coins: (freshKid?.coins ?? 0) + coinsAwarded,
      xp: newXP,
      level: newLevel,
      streak: newStreak,
      last_completed_date: today,
    }).eq('id', completion.kid_id)

    if (completion.quest?.kind === 'oneoff') {
      await supabase.from('quests').update({ active: false }).eq('id', completion.quest.id)
    }

    toast.success(`Quest approved! +${coinsAwarded} coins awarded ✨`)

    if (newLevel > (freshKid?.level ?? 1)) {
      setTimeout(() => toast.success(`⬆️ ${completion.kid?.name ?? 'Level up'}! Reached Level ${newLevel}!`), 600)
    }

    // Per-kid dungeon progress check
    if (activeDungeon) {
      const alreadyCleared = dungeonClears.some(c => c.kid_id === completion.kid_id)
      if (!alreadyCleared) {
        const { data: weeklyData } = await supabase
          .from('completions')
          .select('coins_awarded')
          .eq('kid_id', completion.kid_id)
          .eq('status', 'approved')
          .gte('date', activeDungeon.week_start)

        const kidDamage = weeklyData?.reduce((s, c) => s + (c.coins_awarded ?? 0), 0) ?? 0

        if (kidDamage >= activeDungeon.hp) {
          await supabase.from('dungeon_clears').insert({
            dungeon_run_id: activeDungeon.id,
            kid_id: completion.kid_id,
          })
          const { data: freshKid2 } = await supabase.from('kids').select('coins, xp').eq('id', completion.kid_id).single()
          const k2XP = (freshKid2?.xp ?? 0) + activeDungeon.reward_xp
          await supabase.from('kids').update({
            coins: (freshKid2?.coins ?? 0) + activeDungeon.reward_coins,
            xp: k2XP,
            level: getLevelFromXP(k2XP),
          }).eq('id', completion.kid_id)
          setTimeout(() => toast.success(`🏰 ${completion.kid?.name ?? 'Dungeon'} cleared the dungeon! +${activeDungeon.reward_coins} coins!`), 700)
        }
      }
    }

    // Deal damage to active raid boss
    if (activeBoss && family) {
      const newHP = Math.max(0, activeBoss.current_hp - coinsAwarded)

      await supabase.from('raid_boss_hits').insert({
        boss_id: activeBoss.id,
        completion_id: completionId,
        kid_id: completion.kid_id,
        damage_dealt: coinsAwarded,
      })

      if (newHP === 0) {
        await supabase.from('raid_bosses').update({
          current_hp: 0,
          status: 'defeated',
          defeated_at: new Date().toISOString(),
        }).eq('id', activeBoss.id)

        const { data: allKids } = await supabase.from('kids').select('id, coins, xp').eq('family_id', family.id)
        const perKid = Math.floor(activeBoss.bounty_coins / Math.max(1, allKids?.length ?? 1))
        await Promise.all((allKids ?? []).map(async (k) => {
          const kNewXP = k.xp + perKid
          return supabase.from('kids').update({
            coins: k.coins + perKid,
            xp: kNewXP,
            level: getLevelFromXP(kNewXP),
          }).eq('id', k.id)
        }))
        setTimeout(() => toast.success(`⚔️ Raid boss defeated! ${perKid} coins each!`), 900)
      } else {
        await supabase.from('raid_bosses').update({ current_hp: newHP }).eq('id', activeBoss.id)
      }
    }

    await refetch()
  }, [activeBoss, activeDungeon, dungeonClears, completions, family, refetch, supabase])

  const reject = useCallback(async (completionId: string) => {
    await supabase.from('completions').update({ status: 'rejected' }).eq('id', completionId)
    toast.success('Quest rejected')
    await refetch()
  }, [refetch, supabase])

  const undoApproval = useCallback(async (completionId: string) => {
    const completion = completions.find((c) => c.id === completionId)
    if (!completion) return
    const coinsToRemove = completion.coins_awarded ?? 0

    await supabase
      .from('completions')
      .update({ status: 'pending', approved_at: null, coins_awarded: null })
      .eq('id', completionId)

    if (coinsToRemove > 0) {
      const { data: freshKid } = await supabase
        .from('kids').select('coins, xp').eq('id', completion.kid_id).single()
      const newXP = Math.max(0, (freshKid?.xp ?? 0) - coinsToRemove)
      await supabase.from('kids').update({
        coins: Math.max(0, (freshKid?.coins ?? 0) - coinsToRemove),
        xp: newXP,
        level: getLevelFromXP(newXP),
      }).eq('id', completion.kid_id)
    }
    toast.success('Approval undone — back to pending')
    await refetch()
  }, [completions, refetch, supabase])

  const undoRejection = useCallback(async (completionId: string) => {
    await supabase.from('completions').update({ status: 'pending' }).eq('id', completionId)
    toast.success('Rejection undone — back to pending')
    await refetch()
  }, [refetch, supabase])

  const fulfillRedemption = useCallback(async (redemptionId: string) => {
    const redemption = redemptions.find((r) => r.id === redemptionId)
    if (!redemption) return
    const kid = redemption.kid as Kid | undefined
    const reward = redemption.reward as Reward | undefined
    if (!kid || !reward) return

    const { data: updated, error } = await supabase
      .from('redemptions')
      .update({ status: 'approved' })
      .eq('id', redemptionId)
      .eq('status', 'pending')
      .select('id')

    if (error || !updated || updated.length === 0) {
      toast.error('Request was already cancelled by the kid')
      await refetch()
      return
    }

    await supabase.from('kids').update({ coins: Math.max(0, kid.coins - reward.cost) }).eq('id', kid.id)
    toast.success(`${kid.name} got ${reward.title}! 🎁 -${reward.cost} coins`)
    await refetch()
  }, [redemptions, refetch, supabase])

  const denyRedemption = useCallback(async (redemptionId: string) => {
    const { count } = await supabase.from('redemptions').delete({ count: 'exact' }).eq('id', redemptionId)
    if (count === 0) {
      toast.success('Already cancelled by the kid')
    } else {
      toast.success('Reward request denied')
    }
    await refetch()
  }, [refetch, supabase])

  const undoRedemption = useCallback(async (redemptionId: string) => {
    const redemption = redemptions.find((r) => r.id === redemptionId)
    if (!redemption) return
    const kid = redemption.kid as Kid | undefined
    const reward = redemption.reward as Reward | undefined
    if (!kid || !reward) return
    await supabase.from('redemptions').update({ status: 'pending' }).eq('id', redemptionId)
    const { data: freshKid } = await supabase.from('kids').select('coins').eq('id', kid.id).single()
    await supabase.from('kids').update({ coins: (freshKid?.coins ?? kid.coins) + reward.cost }).eq('id', kid.id)
    toast.success(`Redemption undone — ${reward.cost} coins returned to ${kid.name}`)
    await refetch()
  }, [redemptions, refetch, supabase])

  const undoResolvedCurse = useCallback(async (instanceId: string) => {
    const instance = resolvedCurseInstances.find((ci) => ci.id === instanceId)
    const kid = instance?.kid as Kid | undefined
    const curse = instance?.curse as Curse | undefined
    await supabase.from('curse_instances').update({ status: 'active', resolved_at: null }).eq('id', instanceId)
    toast.success(`${curse?.title ?? 'Curse'} reopened for ${kid?.name ?? 'kid'}`)
    await refetch()
  }, [resolvedCurseInstances, refetch, supabase])

  const addKid = useCallback(async (data: { name: string; avatar: string; color: 'azure' | 'mystic'; pin: string }) => {
    if (!data.name.trim() || data.pin.length !== 4 || !family) return
    const plan = family.plan ?? 'free'
    const limits = PLAN_LIMITS[plan]
    if (limits.maxKids < Infinity && kids.length >= limits.maxKids) {
      toast.error(`Kid limit reached (${limits.maxKids} max on ${PLAN_LABELS[plan]} plan). ${PLAN_UPGRADE_HINT[plan]}`)
      return
    }
    const { error } = await supabase.from('kids').insert({
      family_id: family.id,
      name: data.name.trim(),
      avatar: data.avatar,
      color: data.color,
      pin: data.pin,
    })
    if (!error) {
      toast.success(`${data.name} joined the realm! 🎉`)
      await refetch()
    } else {
      toast.error('Failed to add adventurer')
    }
  }, [family, kids, refetch, supabase])

  const addQuest = useCallback(async (data: AddQuestInput) => {
    if (!data.title.trim() || !family) return
    const plan = family.plan ?? 'free'
    const limits = PLAN_LIMITS[plan]
    const activeQuestCount = quests.filter((q) => q.active).length
    if (limits.maxQuests < Infinity && activeQuestCount >= limits.maxQuests) {
      toast.error(`Quest limit reached (${limits.maxQuests} max on ${PLAN_LABELS[plan]} plan). ${PLAN_UPGRADE_HINT[plan]}`)
      return
    }
    if (data.tier !== 'normal' && !limits.questTiers) {
      toast.error(`Quest tiers require Legendary plan. ${PLAN_UPGRADE_HINT[plan]}`)
      return
    }
    if (data.activeDays.length > 0 && !limits.activeDays) {
      toast.error(`Active day scheduling requires Legendary plan. ${PLAN_UPGRADE_HINT[plan]}`)
      return
    }
    const { error } = await supabase.from('quests').insert({
      family_id: family.id,
      title: data.title.trim(),
      description: data.description.trim() || null,
      icon: data.icon,
      coins: data.coins,
      assigned_to: data.assignedTo,
      kind: data.kind,
      frequency: data.frequency,
      tier: data.tier,
      slots: data.kind === 'shared' ? data.slots : 1,
      active_days: data.activeDays.length > 0 ? data.activeDays : null,
      active: true,
    })
    if (!error) {
      const toastMsg = data.kind === 'shared'
        ? 'Shared bounty added! ⚡'
        : data.kind === 'oneoff'
        ? 'One-time task posted! ⭐'
        : 'Quest added to the board! ⚔️'
      toast.success(toastMsg)
      await refetch()
    } else {
      toast.error('Failed to add quest')
    }
  }, [family, quests, refetch, supabase])

  const toggleQuest = useCallback(async (id: string, active: boolean) => {
    await supabase.from('quests').update({ active: !active }).eq('id', id)
    await refetch()
  }, [refetch, supabase])

  const deleteQuest = useCallback(async (id: string) => {
    await supabase.from('quests').delete().eq('id', id)
    await refetch()
  }, [refetch, supabase])

  const saveQuest = useCallback(async (id: string, updates: Partial<Quest>) => {
    const { error } = await supabase.from('quests').update(updates).eq('id', id)
    if (error) toast.error('Failed to save quest')
    else {
      toast.success('Quest updated!')
      await refetch()
    }
  }, [refetch, supabase])

  const seedDefaultQuests = useCallback(async () => {
    if (!family) return
    const plan = family.plan ?? 'free'
    const limits = PLAN_LIMITS[plan]
    const activeCount = quests.filter((q) => q.active).length
    const slots = limits.maxQuests === Infinity ? DEFAULT_QUESTS.length : Math.max(0, limits.maxQuests - activeCount)
    const toSeed = DEFAULT_QUESTS.slice(0, slots)
    if (toSeed.length === 0) {
      toast.error(`Quest limit reached (${limits.maxQuests} on ${PLAN_LABELS[plan]} plan). ${PLAN_UPGRADE_HINT[plan]}`)
      return
    }
    await supabase.from('quests').insert(
      toSeed.map((q) => ({
        ...q,
        family_id: family.id,
        kind: 'personal' as const,
        frequency: 'daily' as const,
        slots: 1,
        active: true,
      }))
    )
    const msg = toSeed.length < DEFAULT_QUESTS.length
      ? `Added ${toSeed.length}/${DEFAULT_QUESTS.length} starter quests (${PLAN_LABELS[plan]} plan limit) ✨`
      : 'Default quests added! ✨'
    toast.success(msg)
    await refetch()
  }, [family, quests, refetch, supabase])

  const addReward = useCallback(async (data: { title: string; description: string; icon: string; cost: number }) => {
    if (!data.title.trim() || !family) return
    const plan = family.plan ?? 'free'
    const limits = PLAN_LIMITS[plan]
    if (limits.maxRewards < Infinity && rewards.length >= limits.maxRewards) {
      toast.error(`Reward limit reached (${limits.maxRewards} max on ${PLAN_LABELS[plan]} plan). ${PLAN_UPGRADE_HINT[plan]}`)
      return
    }
    const { error } = await supabase.from('rewards').insert({
      family_id: family.id,
      title: data.title.trim(),
      description: data.description.trim() || null,
      icon: data.icon,
      cost: data.cost,
      available: true,
    })
    if (!error) {
      toast.success('Reward added to the store! 🎁')
      await refetch()
    }
  }, [family, rewards, refetch, supabase])

  const deleteReward = useCallback(async (id: string) => {
    await supabase.from('rewards').delete().eq('id', id)
    await refetch()
  }, [refetch, supabase])

  const saveReward = useCallback(async (id: string, updates: { title: string; description: string; icon: string; cost: number }) => {
    if (!updates.title.trim()) return
    const { error } = await supabase.from('rewards').update({
      title: updates.title.trim(),
      description: updates.description.trim() || null,
      icon: updates.icon,
      cost: updates.cost,
    }).eq('id', id)
    if (!error) {
      toast.success('Reward updated!')
      await refetch()
    }
  }, [refetch, supabase])

  const saveResetHour = useCallback(async (hour: number) => {
    if (!family) return
    await supabase.from('families').update({ daily_reset_hour: hour }).eq('id', family.id)
    toast.success('Daily reset time updated!')
    await refetch()
  }, [family, refetch, supabase])

  const saveFamilyName = useCallback(async (name: string) => {
    if (!family || !name.trim()) return
    await supabase.from('families').update({ name: name.trim() }).eq('id', family.id)
    toast.success('Realm name updated!')
    await refetch()
  }, [family, refetch, supabase])

  const saveCoins = useCallback(async (kidId: string, value: number) => {
    if (isNaN(value) || value < 0) return
    await supabase.from('kids').update({ coins: value }).eq('id', kidId)
    toast.success('Coins updated! 🪙')
    await refetch()
  }, [refetch, supabase])

  const setParentPin = useCallback(async (pin: string) => {
    if (!family || pin.length !== 4) return
    const { error } = await supabase.from('families').update({ parent_pin: pin }).eq('id', family.id)
    if (!error) {
      toast.success('Parent lock PIN set! 🔒')
      await refetch()
    } else {
      toast.error('Failed to set PIN')
    }
  }, [family, refetch, supabase])

  const removeParentPin = useCallback(async () => {
    if (!family) return
    await supabase.from('families').update({ parent_pin: null }).eq('id', family.id)
    sessionStorage.removeItem('cq_parent_unlocked')
    toast.success('Parent lock removed')
    await refetch()
  }, [family, refetch, supabase])

  const regenerateApiKey = useCallback(async () => {
    if (!family) return
    await supabase.from('families').update({ api_key: crypto.randomUUID() }).eq('id', family.id)
    toast.success('API key regenerated')
    await refetch()
  }, [family, refetch, supabase])

  const regenerateInviteToken = useCallback(async () => {
    if (!family) return
    await supabase.from('families').update({ invite_token: crypto.randomUUID() }).eq('id', family.id)
    toast.success('Invite link regenerated')
    await refetch()
  }, [family, refetch, supabase])

  const addCurse = useCallback(async (data: { title: string; icon: string; penalty: number }) => {
    if (!data.title.trim() || !family) return
    const plan = family.plan ?? 'free'
    if (!PLAN_LIMITS[plan].curses) {
      toast.error(`Curses require Family plan or higher. ${PLAN_UPGRADE_HINT[plan]}`)
      return
    }
    const { error } = await supabase.from('curses').insert({
      family_id: family.id,
      title: data.title.trim(),
      icon: data.icon,
      penalty: data.penalty,
    })
    if (!error) {
      toast.success('Curse added to the arsenal! ☠️')
      await refetch()
    }
  }, [family, refetch, supabase])

  const deleteCurse = useCallback(async (id: string) => {
    await supabase.from('curses').delete().eq('id', id)
    await refetch()
  }, [refetch, supabase])

  const castCurse = useCallback(async (curseId: string, kidId: string) => {
    const curse = curses.find(c => c.id === curseId)
    const kid = kids.find(k => k.id === kidId)
    if (!curse || !kid) return

    const { error: instanceError } = await supabase.from('curse_instances').insert({
      curse_id: curseId,
      kid_id: kidId,
      coins_deducted: curse.penalty,
      status: 'active',
    })
    if (instanceError) { toast.error('Failed to cast curse'); return }

    const { data: freshKid } = await supabase.from('kids').select('coins').eq('id', kidId).single()
    const { error: coinsError } = await supabase
      .from('kids')
      .update({ coins: Math.max(0, (freshKid?.coins ?? kid.coins) - curse.penalty) })
      .eq('id', kidId)
    if (coinsError) toast.error('Curse cast but coin deduction failed — check manually')
    else toast.success(`${curse.icon} ${curse.title} cast on ${kid.name}! −${curse.penalty} coins`)
    await refetch()
  }, [curses, kids, refetch, supabase])

  const castAdHocCurse = useCallback(async (data: { title: string; icon: string; penalty: number; kidId: string }) => {
    if (!data.title.trim() || !family) return
    const plan = family.plan ?? 'free'
    if (!PLAN_LIMITS[plan].curses) {
      toast.error(`Curses require Family plan or higher. ${PLAN_UPGRADE_HINT[plan]}`)
      return
    }
    const kid = kids.find(k => k.id === data.kidId)
    if (!kid) return

    const { data: curse, error: curseError } = await supabase.from('curses').insert({
      family_id: family.id,
      title: data.title.trim(),
      icon: data.icon,
      penalty: data.penalty,
    }).select('id').single()
    if (curseError || !curse) { toast.error('Failed to cast curse'); return }

    const { error: instanceError } = await supabase.from('curse_instances').insert({
      curse_id: curse.id,
      kid_id: data.kidId,
      coins_deducted: data.penalty,
      status: 'active',
    })
    if (instanceError) { toast.error('Curse created but failed to cast'); return }

    const { data: freshKid } = await supabase.from('kids').select('coins').eq('id', data.kidId).single()
    await supabase.from('kids')
      .update({ coins: Math.max(0, (freshKid?.coins ?? kid.coins) - data.penalty) })
      .eq('id', data.kidId)

    toast.success(`${data.icon} ${data.title.trim()} cast on ${kid.name}! −${data.penalty} coins`)
    await refetch()
  }, [family, kids, refetch, supabase])

  const resolveCurse = useCallback(async (instanceId: string, refund: boolean) => {
    const instance = activeCurseInstances.find(ci => ci.id === instanceId)
    const kid = instance?.kid as Kid | undefined
    if (!instance || !kid) return

    const { error: resolveError } = await supabase
      .from('curse_instances')
      .update({ status: 'resolved', resolved_at: new Date().toISOString() })
      .eq('id', instanceId)
    if (resolveError) { toast.error('Failed to resolve curse'); return }

    if (refund) {
      const { data: freshKid } = await supabase.from('kids').select('coins').eq('id', kid.id).single()
      const { error: coinsError } = await supabase
        .from('kids')
        .update({ coins: (freshKid?.coins ?? kid.coins) + instance.coins_deducted })
        .eq('id', kid.id)
      if (coinsError) toast.error('Curse lifted but refund failed — check manually')
      else toast.success(`Curse lifted — ${instance.coins_deducted} coins refunded to ${kid.name}`)
    } else {
      toast.success('Curse resolved')
    }
    await refetch()
  }, [activeCurseInstances, refetch, supabase])

  const addDungeonRun = useCallback(async (data: { title: string; icon: string; hp: number; rewardCoins: number; rewardXp: number }) => {
    if (!family) return
    const monday = getWeekMonday()
    const { error } = await supabase.from('dungeon_runs').insert({
      family_id: family.id,
      title: data.title.trim() || 'Weekly Dungeon',
      icon: data.icon,
      hp: data.hp,
      reward_coins: data.rewardCoins,
      reward_xp: data.rewardXp,
      week_start: monday,
    })
    if (error) {
      if (error.code === '23505') toast.error('A dungeon already exists for this week')
      else toast.error('Failed to create dungeon')
    } else {
      toast.success(`🏰 ${data.title || 'Weekly Dungeon'} awakens!`)
      await refetch()
    }
  }, [family, refetch, supabase])

  const deleteDungeonRun = useCallback(async (id: string) => {
    await supabase.from('dungeon_runs').delete().eq('id', id)
    await refetch()
  }, [refetch, supabase])

  const addRaidBoss = useCallback(async (data: { title: string; icon: string; hpPerKid: number; bountyCoins: number }) => {
    if (!family || !data.title.trim()) return
    const totalHP = data.hpPerKid * Math.max(1, kids.length)
    const { error } = await supabase.from('raid_bosses').insert({
      family_id: family.id,
      title: data.title.trim(),
      icon: data.icon,
      max_hp: totalHP,
      current_hp: totalHP,
      bounty_coins: data.bountyCoins,
      status: 'active',
    })
    if (!error) {
      toast.success(`🐉 ${data.title} has appeared! ${totalHP} HP · ${data.bountyCoins} coin bounty`)
      await refetch()
    } else {
      toast.error('Failed to summon raid boss')
    }
  }, [family, kids, refetch, supabase])

  const deleteRaidBoss = useCallback(async (id: string) => {
    await supabase.from('raid_bosses').delete().eq('id', id)
    await refetch()
  }, [refetch, supabase])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }, [router, supabase])

  return {
    approve, reject, undoApproval, undoRejection,
    fulfillRedemption, denyRedemption, undoRedemption, undoResolvedCurse,
    addKid,
    addQuest, toggleQuest, deleteQuest, saveQuest, seedDefaultQuests,
    addReward, deleteReward, saveReward,
    saveResetHour, saveFamilyName, saveCoins,
    setParentPin, removeParentPin,
    regenerateApiKey, regenerateInviteToken,
    addCurse, deleteCurse, castCurse, castAdHocCurse, resolveCurse,
    addDungeonRun, deleteDungeonRun, addRaidBoss, deleteRaidBoss,
    signOut,
  }
}
