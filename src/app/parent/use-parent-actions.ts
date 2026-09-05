'use client'

import { useCallback } from 'react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Family, Kid, Quest, QuestKind, QuestFrequency, QuestTier, Completion, Reward, Redemption, Curse, CurseInstance } from '@/lib/types'
import { DEFAULT_QUESTS } from '@/lib/constants'
import { LEGENDARY_UPGRADE_HINT, PLAN_LIMITS, PLAN_LABELS, PLAN_UPGRADE_HINT } from '@/lib/plans'
import { isValidPin, questDateStringForZone, questWeekKeyForZone } from '@/lib/utils'
import { boundedInteger } from '@/lib/validation'
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
  saveCoins: (kidId: string, value: number, reason?: string) => Promise<void>
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

    const { data: approved, error } = await supabase.rpc('approve_completion_with_ledger', {
      p_completion_id: completionId,
    })
    const approval = approved as {
      applied?: boolean
      reason?: string
      coins_awarded?: number
      level?: number
    } | null

    if (error || !approval?.applied) {
      toast.error(approval?.reason === 'already_processed' ? 'Quest was already reviewed' : 'Could not approve quest')
      await refetch()
      return
    }

    const coinsAwarded = approval.coins_awarded ?? completion.coins_requested ?? completion.quest?.coins ?? 0
    const newLevel = approval.level ?? ((completion.kid as Kid | undefined)?.level ?? 1)
    toast.success(`Quest approved! +${coinsAwarded} coins awarded ✨`)

    if (newLevel > ((completion.kid as Kid | undefined)?.level ?? 1)) {
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
          .lte('date', questDateStringForZone(family?.daily_reset_hour ?? 0, family?.timezone ?? 'UTC'))

        const kidDamage = weeklyData?.reduce((s, c) => s + (c.coins_awarded ?? 0), 0) ?? 0

        if (kidDamage >= activeDungeon.hp) {
          const { data: clear, error: clearError } = await supabase.rpc('award_dungeon_clear', {
            p_dungeon_run_id: activeDungeon.id,
            p_kid_id: completion.kid_id,
          })
          const clearResult = clear as { awarded?: boolean; coins?: number } | null
          if (clearError) {
            toast.error('Dungeon cleared, but the bonus could not be awarded')
          } else if (clearResult?.awarded) {
            setTimeout(() => toast.success(`🏰 ${completion.kid?.name ?? 'Dungeon'} cleared the dungeon! +${activeDungeon.reward_coins} coins!`), 700)
          }
        }
      }
    }

    // Deal damage to active raid boss
    if (activeBoss && family) {
      const { data: raid, error: raidError } = await supabase.rpc('apply_raid_hit', {
        p_boss_id: activeBoss.id,
        p_completion_id: completionId,
      })
      const raidResult = raid as { applied?: boolean; defeated?: boolean; per_kid?: number } | null
      if (raidError) {
        toast.error('Quest approved, but raid damage could not be applied')
      } else if (raidResult?.defeated) {
        setTimeout(() => toast.success(`⚔️ Raid boss defeated! ${raidResult.per_kid ?? 0} coins each!`), 900)
      }
    }

    await refetch()
  }, [activeBoss, activeDungeon, dungeonClears, completions, family, refetch, supabase])

  const reject = useCallback(async (completionId: string) => {
    const { data: updated, error } = await supabase
      .from('completions')
      .update({ status: 'rejected', approved_at: new Date().toISOString() })
      .eq('id', completionId)
      .eq('status', 'pending')
      .select('id')
    if (error || !updated || updated.length === 0) {
      toast.error('Quest was already reviewed')
      await refetch()
      return
    }
    toast.success('Quest rejected')
    await refetch()
  }, [refetch, supabase])

  const undoApproval = useCallback(async (completionId: string) => {
    const completion = completions.find((c) => c.id === completionId)
    if (!completion) return
    const { data: reversed, error } = await supabase.rpc('undo_completion_approval_with_ledger', {
      p_completion_id: completionId,
    })
    const reversal = reversed as { applied?: boolean; reason?: string } | null
    if (error || !reversal?.applied) {
      toast.error(reversal?.reason === 'not_approved' ? 'Approval was already undone' : 'Could not undo approval')
      await refetch()
      return
    }
    toast.success('Approval undone — back to pending')
    await refetch()
  }, [completions, refetch, supabase])

  const undoRejection = useCallback(async (completionId: string) => {
    const { data: undone, error } = await supabase
      .from('completions')
      .update({ status: 'pending', approved_at: null })
      .eq('id', completionId)
      .eq('status', 'rejected')
      .select('id')
    if (error || !undone || undone.length === 0) {
      toast.error('Rejection was already undone')
      await refetch()
      return
    }
    toast.success('Rejection undone — back to pending')
    await refetch()
  }, [refetch, supabase])

  const fulfillRedemption = useCallback(async (redemptionId: string) => {
    const redemption = redemptions.find((r) => r.id === redemptionId)
    if (!redemption) return
    const kid = redemption.kid as Kid | undefined
    const reward = redemption.reward as Reward | undefined
    if (!kid || !reward) return

    // Server-side route: authenticates parent, verifies family ownership,
    // atomically fetches fresh coins before deducting, idempotency-guarded
    const res = await fetch(`/api/parent/redemptions/${redemptionId}/approve`, { method: 'POST' })
    const result = await res.json().catch(() => ({})) as { error?: string; coinsDeducted?: number }

    if (res.status === 409) {
      toast.error(result.error ?? 'Request was already processed')
    } else if (!res.ok) {
      toast.error('Could not process — try again')
    } else {
      toast.success(`${kid.name} got ${reward.title}! 🎁 -${result.coinsDeducted ?? redemption.cost_charged ?? reward.cost} coins`)
    }

    await refetch()
  }, [redemptions, refetch])

  const denyRedemption = useCallback(async (redemptionId: string) => {
    // Server-side route: soft-deletes with status='denied' to preserve audit trail
    const res = await fetch(`/api/parent/redemptions/${redemptionId}/deny`, { method: 'POST' })

    if (res.status === 409) {
      toast.success('Already cancelled by the kid')
    } else if (!res.ok) {
      toast.error('Could not deny — try again')
    } else {
      toast.success('Reward request denied')
    }
    await refetch()
  }, [refetch])

  const undoResolvedCurse = useCallback(async (instanceId: string) => {
    const instance = resolvedCurseInstances.find((ci) => ci.id === instanceId)
    const kid = instance?.kid as Kid | undefined
    const curse = instance?.curse as Curse | undefined
    if (!family?.api_key || !instance) return
    const res = await fetch(`/api/curse-instances/${instanceId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${family.api_key}` },
      body: JSON.stringify({ reopen: true }),
    })
    if (!res.ok) {
      toast.error('Could not reopen curse')
      await refetch()
      return
    }
    toast.success(`${curse?.title ?? 'Curse'} reopened for ${kid?.name ?? 'kid'}`)
    await refetch()
  }, [family, resolvedCurseInstances, refetch])

  const addKid = useCallback(async (data: { name: string; avatar: string; color: 'azure' | 'mystic'; pin: string }) => {
    if (!data.name.trim() || !isValidPin(data.pin) || !family) return
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
    if (boundedInteger(data.coins, { min: 0, max: 1_000_000 }) === null || boundedInteger(data.slots, { min: 1, max: 100 }) === null) {
      toast.error('Quest coins or slots are invalid')
      return
    }
    const plan = family.plan ?? 'free'
    const limits = PLAN_LIMITS[plan]
    const activeQuestCount = quests.filter((q) => q.active).length
    if (limits.maxQuests < Infinity && activeQuestCount >= limits.maxQuests) {
      toast.error(`Quest limit reached (${limits.maxQuests} max on ${PLAN_LABELS[plan]} plan). ${PLAN_UPGRADE_HINT[plan]}`)
      return
    }
    if (data.tier !== 'normal' && !limits.questTiers) {
      toast.error(`Quest tiers require Legendary plan. ${LEGENDARY_UPGRADE_HINT[plan]}`)
      return
    }
    if (data.activeDays.length > 0 && !limits.activeDays) {
      toast.error(`Active day scheduling requires Legendary plan. ${LEGENDARY_UPGRADE_HINT[plan]}`)
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
    const plan = family?.plan ?? 'free'
    if (!active && plan === 'free' && quests.filter((quest) => quest.active).length >= PLAN_LIMITS.free.maxQuests) {
      toast.error(`Quest limit reached (${PLAN_LIMITS.free.maxQuests} max on Free plan). ${PLAN_UPGRADE_HINT[plan]}`)
      return
    }
    const { error } = await supabase.from('quests').update({ active: !active }).eq('id', id)
    if (error) toast.error('Failed to update quest')
    else toast.success(active ? 'Quest paused' : 'Quest reactivated')
    await refetch()
  }, [family, quests, refetch, supabase])

  const deleteQuest = useCallback(async (id: string) => {
    const { error } = await supabase.from('quests').update({ archived: true, active: false }).eq('id', id).eq('archived', false)
    if (error) toast.error('Failed to delete quest')
    else toast.success('Quest deleted')
    await refetch()
  }, [refetch, supabase])

  const saveQuest = useCallback(async (id: string, updates: Partial<Quest>) => {
    if (updates.coins !== undefined && boundedInteger(updates.coins, { min: 0, max: 1_000_000 }) === null) {
      toast.error('Quest coins must be a non-negative integer')
      return
    }
    if (updates.slots !== undefined && boundedInteger(updates.slots, { min: 1, max: 100 }) === null) {
      toast.error('Quest slots must be between 1 and 100')
      return
    }
    const plan = family?.plan ?? 'free'
    if (updates.tier && updates.tier !== 'normal' && !PLAN_LIMITS[plan].questTiers) {
      toast.error(`Quest tiers require Legendary plan. ${LEGENDARY_UPGRADE_HINT[plan]}`)
      return
    }
    if (Array.isArray(updates.active_days) && updates.active_days.length > 0 && !PLAN_LIMITS[plan].activeDays) {
      toast.error(`Active day scheduling requires Legendary plan. ${LEGENDARY_UPGRADE_HINT[plan]}`)
      return
    }
    const { error } = await supabase.from('quests').update(updates).eq('id', id)
    if (error) toast.error('Failed to save quest')
    else {
      toast.success('Quest updated!')
      await refetch()
    }
  }, [family, refetch, supabase])

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
    if (boundedInteger(data.cost, { min: 1, max: 1_000_000 }) === null) {
      toast.error('Reward cost must be a positive integer')
      return
    }
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
    const { error } = await supabase.from('rewards').update({ archived: true, available: false }).eq('id', id).eq('archived', false)
    if (error) toast.error('Failed to delete reward')
    else toast.success('Reward removed')
    await refetch()
  }, [refetch, supabase])

  const saveReward = useCallback(async (id: string, updates: { title: string; description: string; icon: string; cost: number }) => {
    if (!updates.title.trim()) return
    if (boundedInteger(updates.cost, { min: 1, max: 1_000_000 }) === null) {
      toast.error('Reward cost must be a positive integer')
      return
    }
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

  const saveCoins = useCallback(async (kidId: string, value: number, reason?: string) => {
    if (boundedInteger(value, { min: 0, max: 1_000_000_000 }) === null) return
    const { data, error } = await supabase.rpc('set_kid_coin_balance', {
      p_kid_id: kidId,
      p_new_balance: value,
      p_reason: reason?.trim() || null,
    })
    const result = data as { applied?: boolean; reason?: string } | null
    if (error) {
      toast.error('Could not adjust coins')
      await refetch()
      return
    }
    if (!result?.applied && result?.reason === 'unchanged') {
      toast.info('Balance is already at that amount')
      return
    }
    toast.success('Coin adjustment posted! 🪙')
    await refetch()
  }, [refetch, supabase])

  const setParentPin = useCallback(async (pin: string) => {
    if (!family || !isValidPin(pin)) return
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
    if (boundedInteger(data.penalty, { min: 1, max: 1_000_000 }) === null) {
      toast.error('Curse penalty must be a positive integer')
      return
    }
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
    const { error } = await supabase.from('curses').update({ archived: true }).eq('id', id).eq('archived', false)
    if (error) toast.error('Failed to delete curse')
    else toast.success('Curse removed from arsenal')
    await refetch()
  }, [refetch, supabase])

  const castCurse = useCallback(async (curseId: string, kidId: string) => {
    const curse = curses.find(c => c.id === curseId)
    const kid = kids.find(k => k.id === kidId)
    if (!curse || !kid || !family?.api_key) return

    const res = await fetch(`/api/curses/${curseId}/cast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${family.api_key}` },
      body: JSON.stringify({ kid_id: kidId }),
    })
    const result = await res.json().catch(() => ({})) as { coins_deducted?: number }
    if (!res.ok) toast.error('Failed to cast curse')
    else toast.success(`${curse.icon} ${curse.title} cast on ${kid.name}! −${result.coins_deducted ?? 0} coins`)
    await refetch()
  }, [curses, family, kids, refetch])

  const castAdHocCurse = useCallback(async (data: { title: string; icon: string; penalty: number; kidId: string }) => {
    if (!data.title.trim() || !family) return
    if (boundedInteger(data.penalty, { min: 1, max: 1_000_000 }) === null) {
      toast.error('Curse penalty must be a positive integer')
      return
    }
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

    if (!family.api_key) return
    const res = await fetch(`/api/curses/${curse.id}/cast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${family.api_key}` },
      body: JSON.stringify({ kid_id: data.kidId }),
    })
    const result = await res.json().catch(() => ({})) as { coins_deducted?: number }
    if (!res.ok) {
      toast.error('Curse created but failed to cast')
      return
    }

    toast.success(`${data.icon} ${data.title.trim()} cast on ${kid.name}! −${result.coins_deducted ?? 0} coins`)
    await refetch()
  }, [family, kids, refetch, supabase])

  const resolveCurse = useCallback(async (instanceId: string, refund: boolean) => {
    const instance = activeCurseInstances.find(ci => ci.id === instanceId)
    const kid = instance?.kid as Kid | undefined
    if (!instance || !kid || !family?.api_key) return

    const res = await fetch(`/api/curse-instances/${instanceId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${family.api_key}` },
      body: JSON.stringify({ refund }),
    })
    if (!res.ok) {
      toast.error('Failed to resolve curse')
      await refetch()
      return
    }

    if (refund) toast.success(`Curse lifted — ${instance.coins_deducted} coins refunded to ${kid.name}`)
    else toast.success('Curse resolved')
    await refetch()
  }, [activeCurseInstances, family, refetch])

  const addDungeonRun = useCallback(async (data: { title: string; icon: string; hp: number; rewardCoins: number; rewardXp: number }) => {
    if (!family) return
    const plan = family.plan ?? 'free'
    if (!PLAN_LIMITS[plan].challenges) {
      toast.error(`Challenges require Legendary plan. ${LEGENDARY_UPGRADE_HINT[plan]}`)
      return
    }
    if (
      boundedInteger(data.hp, { min: 1, max: 1_000_000 }) === null ||
      boundedInteger(data.rewardCoins, { min: 0, max: 1_000_000 }) === null ||
      boundedInteger(data.rewardXp, { min: 0, max: 1_000_000 }) === null
    ) {
      toast.error('Dungeon values must be whole, non-negative numbers')
      return
    }
    const monday = questWeekKeyForZone(family.daily_reset_hour ?? 0, family.timezone ?? 'UTC')
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
    const { error } = await supabase.from('dungeon_runs').update({ archived: true }).eq('id', id).eq('archived', false)
    if (error) toast.error('Failed to delete dungeon')
    else toast.success('Dungeon dismissed')
    await refetch()
  }, [refetch, supabase])

  const addRaidBoss = useCallback(async (data: { title: string; icon: string; hpPerKid: number; bountyCoins: number }) => {
    if (!family || !data.title.trim()) return
    const plan = family.plan ?? 'free'
    if (!PLAN_LIMITS[plan].challenges) {
      toast.error(`Challenges require Legendary plan. ${LEGENDARY_UPGRADE_HINT[plan]}`)
      return
    }
    if (
      boundedInteger(data.hpPerKid, { min: 1, max: 1_000_000 }) === null ||
      boundedInteger(data.bountyCoins, { min: 0, max: 1_000_000 }) === null
    ) {
      toast.error('Raid boss values must be whole, non-negative numbers')
      return
    }
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
    const { error } = await supabase.from('raid_bosses').update({ archived: true }).eq('id', id).eq('archived', false)
    if (error) toast.error('Failed to dismiss raid boss')
    else toast.success('Raid boss dismissed')
    await refetch()
  }, [refetch, supabase])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }, [router, supabase])

  return {
    approve, reject, undoApproval, undoRejection,
    fulfillRedemption, denyRedemption, undoResolvedCurse,
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
