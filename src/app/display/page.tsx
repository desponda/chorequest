'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { DisplaySkeleton } from '@/components/skeletons'
import { KidColumn } from '@/components/kid-column'
import type { Kid, Quest, Completion, Family, Reward, DungeonRun, DungeonClear, RaidBoss } from '@/lib/types'
import { KID_COLORS, TIER_CONFIG } from '@/lib/constants'
import { dateKeyDayOfWeek, questDateStringForZone, questWeekKeyForZone } from '@/lib/utils'
import { sharedQuestPeriodFilter } from '@/lib/quest-rules'
import { toast } from 'sonner'
import { useEscapeToClose } from '@/lib/use-escape-to-close'
import { useFocusTrap } from '@/lib/use-focus-trap'
import { RealmIcon } from '@/components/ui/realm-icon'
import { RealmEmblem } from '@/components/ui/realm-emblem'

export default function WallDisplay() {
  const [family, setFamily] = useState<Family | null>(null)
  const [kids, setKids] = useState<Kid[]>([])
  const [quests, setQuests] = useState<Quest[]>([])
  const [completions, setCompletions] = useState<Completion[]>([])
  const [activeCurseCounts, setActiveCurseCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [pendingCount, setPendingCount] = useState(0)
  const [claimingBounty, setClaimingBounty] = useState<Quest | null>(null)
  const [rewards, setRewards] = useState<Reward[]>([])
  const [showRewards, setShowRewards] = useState(false)
  const [showBounty, setShowBounty] = useState(false)
  const [activeDungeon, setActiveDungeon] = useState<DungeonRun | null>(null)
  const [dungeonClears, setDungeonClears] = useState<DungeonClear[]>([])
  const [weeklyCompletions, setWeeklyCompletions] = useState<Completion[]>([])
  const [activeBoss, setActiveBoss] = useState<RaidBoss | null>(null)
  const [supabase] = useState(createClient)

  useEscapeToClose(showBounty, () => setShowBounty(false))
  useEscapeToClose(showRewards, () => setShowRewards(false))
  useEscapeToClose(claimingBounty !== null, () => setClaimingBounty(null))
  const bountyTrapRef = useFocusTrap<HTMLDivElement>(showBounty)
  const rewardsTrapRef = useFocusTrap<HTMLDivElement>(showRewards)
  const claimTrapRef = useFocusTrap<HTMLDivElement>(claimingBounty !== null)

  const fetchData = useCallback(async () => {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('family_id')
      .single()

    if (profileError || !profile) {
      setLoadError('We could not load your family profile.')
      setLoading(false)
      return
    }

    const [familyRes, kidsRes, questsRes, rewardsRes] = await Promise.all([
      supabase.from('families').select('id, name, invite_token, daily_reset_hour, timezone, created_at, plan').eq('id', profile.family_id).single(),
      supabase.from('kids').select('id, name, avatar, color, coins, streak, last_completed_date, xp, level, family_id, created_at').eq('family_id', profile.family_id).order('created_at'),
      supabase.from('quests').select('*').eq('family_id', profile.family_id).eq('active', true).eq('archived', false).order('created_at'),
      supabase.from('rewards').select('*').eq('available', true).eq('archived', false).order('cost'),
    ])

    if (familyRes.error || kidsRes.error || questsRes.error) {
      setLoadError('The realm could not be loaded. Check your connection and try again.')
      setLoading(false)
      return
    }
    setLoadError(null)

    const resetHour = familyRes.data?.daily_reset_hour ?? 0
    const timeZone = familyRes.data?.timezone ?? 'UTC'
    const today = questDateStringForZone(resetHour, timeZone)
    const weekStart = questWeekKeyForZone(resetHour, timeZone)

    const [completionsRes, cursesRes, dungeonRes, bossRes, weeklyCompletionsRes] = await Promise.all([
      supabase.from('completions').select('*').gte('date', weekStart).lte('date', today),
      supabase.from('curse_instances').select('kid_id').eq('status', 'active'),
      supabase.from('dungeon_runs').select('*').eq('family_id', profile.family_id).eq('week_start', weekStart).eq('archived', false).maybeSingle(),
      supabase.from('raid_bosses').select('*').eq('family_id', profile.family_id).eq('status', 'active').eq('archived', false).maybeSingle(),
      supabase.from('completions').select('kid_id, coins_awarded').eq('status', 'approved').gte('date', weekStart).lte('date', today),
    ])

    if (familyRes.data) setFamily({ ...familyRes.data, has_parent_pin: false, plan: (familyRes.data.plan as import('@/lib/types').Plan) ?? 'free' })
    if (kidsRes.data) setKids(kidsRes.data)
    if (questsRes.data) setQuests(questsRes.data)
    if (rewardsRes.data) setRewards(rewardsRes.data)

    const allCompletions = completionsRes.data ?? []
    setCompletions(allCompletions)
    setPendingCount(allCompletions.filter(c => c.status === 'pending' && c.date === today).length)

    const counts: Record<string, number> = {}
    for (const ci of cursesRes.data ?? []) {
      counts[ci.kid_id] = (counts[ci.kid_id] ?? 0) + 1
    }
    setActiveCurseCounts(counts)

    const dungeon = (dungeonRes.data as DungeonRun) ?? null
    setActiveDungeon(dungeon)
    if (dungeon) {
      const { data: clears } = await supabase.from('dungeon_clears').select('*').eq('dungeon_run_id', dungeon.id)
      setDungeonClears((clears ?? []) as DungeonClear[])
    } else {
      setDungeonClears([])
    }
    setActiveBoss((bossRes.data as RaidBoss) ?? null)
    setWeeklyCompletions((weeklyCompletionsRes.data ?? []) as Completion[])

    setLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchData()

    const channel = supabase
      .channel('wall-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'completions' }, fetchData)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'kids' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'curse_instances' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dungeon_runs' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dungeon_clears' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'raid_bosses' }, fetchData)
      .subscribe()

    // Fallback poll every 60s in case realtime misses an event (dropped WS, backgrounded tab, etc.)
    const poll = setInterval(fetchData, 60_000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(poll)
    }
  }, [fetchData, supabase])

  const handleComplete = useCallback(
    async (questId: string, kidId: string) => {
      const quest = quests.find((q) => q.id === questId)
      if (!quest) return

      const today = questDateStringForZone(family?.daily_reset_hour ?? 0, family?.timezone ?? 'UTC')

      if (quest.kind === 'shared') {
        const weekStartNow = questWeekKeyForZone(family?.daily_reset_hour ?? 0, family?.timezone ?? 'UTC')
        const inPeriod = sharedQuestPeriodFilter(quest, today, weekStartNow)
        const familyCount = completions.filter(c =>
          c.quest_id === questId &&
          inPeriod(c.date) &&
          (c.status === 'approved' || c.status === 'pending'),
        ).length
        if (familyCount >= quest.slots) {
          toast.error('All slots claimed!')
          return
        }
      }

      const { data: submission, error } = await supabase.rpc('submit_quest', {
        p_kid_id: kidId,
        p_quest_id: questId,
        p_date: today,
      })

      const result = submission as { success?: boolean; reason?: string } | null
      if (error || !result?.success) {
        toast.error(result?.reason === 'slots_full' ? 'All slots claimed!' : result?.reason === 'already_submitted' ? 'Already completed!' : 'Something went wrong')
        return
      }

      toast.success(`Quest submitted! ✨`, {
        description: `${quest.coins} coins pending approval`,
      })

      await fetchData()
    },
    [quests, supabase, fetchData, family?.daily_reset_hour, family?.timezone, completions]
  )

  const handleClaimBounty = useCallback(
    async (questId: string, kidId: string) => {
      await handleComplete(questId, kidId)
      setClaimingBounty(null)
    },
    [handleComplete]
  )

  const today = questDateStringForZone(family?.daily_reset_hour ?? 0, family?.timezone ?? 'UTC')
  const weekStart = questWeekKeyForZone(family?.daily_reset_hour ?? 0, family?.timezone ?? 'UTC')
  const dayOfWeek = dateKeyDayOfWeek(today)

  const getKidPersonalQuests = (kid: Kid) =>
    quests.filter(q => {
      if (q.kind !== 'personal') return false
      if (q.assigned_to && q.assigned_to !== kid.id) return false
      if (q.active_days?.length && !q.active_days.includes(dayOfWeek)) return false
      return true
    })

  const bountyQuests = quests.filter(q => {
    if (q.kind !== 'shared' && q.kind !== 'oneoff') return false
    if (q.active_days?.length && !q.active_days.includes(dayOfWeek)) return false
    return true
  })

  const getFamilyCount = (quest: Quest) => {
    const inPeriod = sharedQuestPeriodFilter(quest, today, weekStart)
    return completions.filter(c =>
      c.quest_id === quest.id &&
      inPeriod(c.date) &&
      (c.status === 'approved' || c.status === 'pending'),
    ).length
  }

  const getKidCompletions = (kid: Kid) =>
    completions.filter((c) => c.kid_id === kid.id)

  const familySharedCompletions = completions.filter(c => {
    const q = quests.find(qq => qq.id === c.quest_id)
    return q?.kind === 'shared' || q?.kind === 'oneoff'
  })

  const personalQuestCount = kids.reduce((total, kid) => total + getKidPersonalQuests(kid).length, 0)
  const completedQuestCount = kids.reduce((total, kid) => total + getKidPersonalQuests(kid).filter(quest => {
    const completion = getKidCompletions(kid).find(c => c.quest_id === quest.id && c.date === today)
    return completion?.status === 'approved'
  }).length, 0)
  const totalQuestCount = personalQuestCount + bountyQuests.length

  if (loading) {
    return <DisplaySkeleton />
  }

  if (loadError) {
    return (
      <div className="min-h-screen cq-page-shell flex items-center justify-center px-4 text-center safe-top safe-bottom">
        <div className="relative z-10 max-w-sm">
          <div className="cq-hero-emblem h-14 w-14 flex items-center justify-center mx-auto mb-4 text-cq-azure" aria-hidden="true"><RealmEmblem name="spark" size={34} /></div>
          <h1 className="font-heading text-2xl font-bold text-white mb-2">The realm is out of reach</h1>
          <p className="text-white/60 text-sm mb-6">{loadError}</p>
          <button
            type="button"
            onClick={() => {
              setLoading(true)
              fetchData()
            }}
            className="min-h-11 px-6 rounded-xl text-sm font-bold text-cq-gold"
            style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.3)' }}
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  if (kids.length === 0) {
    return (
      <div className="min-h-screen cq-page-shell flex items-center justify-center">
        <motion.div
          className="relative z-10 text-center px-6 max-w-md"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="cq-hero-emblem h-20 w-20 flex items-center justify-center mx-auto mb-6 text-cq-gold"><RealmEmblem name="dungeon" size={54} /></div>
          <h1 className="font-heading text-4xl font-bold text-white mb-4">Welcome, Realm Master</h1>
          <p className="text-white/50 text-lg mb-8">
            Add your young adventurers to begin the quests.
          </p>
          <Link
            href="/parent"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl font-bold text-lg transition-all"
            style={{
              background: 'rgba(251, 191, 36, 0.15)',
              border: '1px solid rgba(251, 191, 36, 0.35)',
              color: '#fbbf24',
            }}
          >
            <RealmIcon name="⚙️" size={18} /> Set Up Your Realm
          </Link>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen cq-page-shell flex flex-col">

      {/* Family command header */}
      <motion.header
        className="cq-display-header safe-top relative z-10 mx-4 sm:mx-8 mt-4 sm:mt-6 mb-3 sm:mb-4 px-4 sm:px-6 py-4 sm:py-5 flex-shrink-0"
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="cq-display-brand">
          <span className="cq-display-mark" aria-hidden="true"><RealmEmblem name="dungeon" size={31} /></span>
          <div className="min-w-0">
            <p className="cq-display-kicker">Family command center</p>
            <h1 className="cq-display-title">ChoreQuest</h1>
            <p className="cq-display-subtitle">{family ? `${family.name} family realm` : 'Your family realm'}</p>
          </div>
        </div>

        <div className="cq-display-actions">
          {bountyQuests.length > 0 && (
            <button
              onClick={() => setShowBounty(true)}
              aria-label="Open bounty board"
              className="relative flex items-center justify-center gap-1.5 min-w-11 min-h-11 px-2.5 sm:px-4 py-2 rounded-xl text-sm font-semibold transition-all"
              style={{
                background: 'rgba(251,191,36,0.12)',
                border: '1px solid rgba(251,191,36,0.35)',
                color: '#fbbf24',
              }}
            >
              <RealmIcon name="⚡" size={17} /><span className="hidden sm:inline"> Bounty</span>
              {bountyQuests.some(q => getFamilyCount(q) < q.slots) && (
                <span
                  className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full"
                  style={{ background: '#fbbf24' }}
                  aria-hidden="true"
                />
              )}
            </button>
          )}
          <button
            onClick={() => setShowRewards(true)}
            aria-label="View rewards"
            className="flex items-center justify-center gap-1.5 min-w-11 min-h-11 px-2.5 sm:px-4 py-2 rounded-xl text-sm font-semibold transition-all"
            style={{
              background: 'rgba(251,191,36,0.08)',
              border: '1px solid rgba(251,191,36,0.2)',
              color: 'rgba(251,191,36,0.7)',
            }}
          >
            <RealmIcon name="🎁" size={17} /><span className="hidden sm:inline"> Rewards</span>
          </button>
          {pendingCount > 0 && (
            <motion.div
              animate={{ scale: [1, 1.04, 1] }}
              transition={{ duration: 1.8, repeat: Infinity }}
            >
              <Link
                href="/parent"
                aria-label={`${pendingCount} pending approvals`}
                className="flex items-center justify-center gap-1.5 min-w-11 min-h-11 px-2.5 sm:px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                style={{
                  background: 'rgba(251, 191, 36, 0.14)',
                  border: '1px solid rgba(251, 191, 36, 0.32)',
                  color: '#fbbf24',
                }}
              >
                <span className="relative flex h-2 w-2 flex-shrink-0" aria-hidden="true">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cq-gold opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-cq-gold" />
                </span>
                <span className="hidden sm:inline">{pendingCount} pending</span>
                <span className="sm:hidden text-xs font-bold">{pendingCount}</span>
              </Link>
            </motion.div>
          )}
          <Link
            href="/parent"
            aria-label="Parent dashboard"
            className="flex items-center justify-center min-w-11 min-h-11 px-2.5 sm:px-4 py-2 rounded-xl text-sm text-white/50 hover:text-white/80 transition-all glass border-glass"
          >
            <RealmIcon name="⚙️" size={17} /><span className="hidden sm:inline"> Parent</span>
          </Link>
        </div>
      </motion.header>

      <motion.section
        className="cq-display-overview relative z-10 mx-4 sm:mx-8 mb-4 sm:mb-5"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.16 }}
        aria-label="Today at a glance"
      >
        <div className="cq-display-overview-intro">
          <p className="cq-display-kicker">Today at a glance</p>
          <h2>Keep the momentum going.</h2>
          <p>Every small win moves the whole family forward.</p>
        </div>
        <div className="cq-display-metrics">
          <div className="cq-display-metric"><strong>{kids.length}</strong><span>adventurers</span></div>
          <div className="cq-display-metric"><strong>{completedQuestCount}<span className="cq-display-metric-muted">/{totalQuestCount}</span></strong><span>quests cleared</span></div>
          <div className="cq-display-metric cq-display-metric-accent"><strong>{pendingCount}</strong><span>awaiting approval</span></div>
        </div>
      </motion.section>

      {/* Dungeon + Raid Boss progress bar */}
      {(activeDungeon || activeBoss) && (
        <div className="relative z-10 px-4 sm:px-8 pb-2 flex flex-col gap-2">
          {/* Raid Boss — shared HP bar across full width */}
          {activeBoss && (
            <motion.div
              className="rounded-2xl px-4 py-3 flex items-center gap-4"
              style={{ background: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.2)' }}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <motion.span
                className="text-2xl flex-shrink-0"
                animate={{ scale: [1, 1.08, 1] }}
                transition={{ duration: 2.5, repeat: Infinity }}
              >
                <RealmIcon name={activeBoss.icon} size={24} />
              </motion.span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="font-heading text-sm font-bold text-white/80 truncate">{activeBoss.title}</p>
                  <p className="text-xs text-white/35 flex-shrink-0 ml-2">{activeBoss.current_hp.toLocaleString()} / {activeBoss.max_hp.toLocaleString()} HP</p>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: 'linear-gradient(90deg, #fb923c, #ef4444)' }}
                    initial={{ width: '100%' }}
                    animate={{ width: `${Math.round((activeBoss.current_hp / activeBoss.max_hp) * 100)}%` }}
                    transition={{ duration: 0.9, ease: 'easeOut' }}
                  />
                </div>
              </div>
              <p className="text-xs text-cq-ember font-bold flex-shrink-0 inline-flex items-center gap-1"><RealmIcon name="⚙️" size={12} />{activeBoss.bounty_coins} bounty</p>
            </motion.div>
          )}

          {/* Dungeon — per-kid progress bars in a row */}
          {activeDungeon && (
            <motion.div
              className="rounded-2xl px-4 py-3"
              style={{ background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.16)' }}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
            >
              <div className="flex items-center gap-2 mb-2.5">
                <span className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(56,189,248,0.12)', color: '#38bdf8' }}><RealmIcon name={activeDungeon.icon} size={17} /></span>
                <p className="font-heading text-xs font-bold text-white/60 tracking-wide">{activeDungeon.title}</p>
                <p className="text-xs text-white/30 ml-auto inline-flex items-center gap-1"><RealmIcon name="🪙" size={12} />+{activeDungeon.reward_coins} <RealmIcon name="✨" size={12} />+{activeDungeon.reward_xp} per adventurer</p>
              </div>
              <div
                className="grid gap-3"
                style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 132px), 1fr))' }}
              >
                {kids.map(kid => {
                  const damage = weeklyCompletions
                    .filter(c => c.kid_id === kid.id)
                    .reduce((s, c) => s + (c.coins_awarded ?? 0), 0)
                  const cleared = dungeonClears.some(c => c.kid_id === kid.id)
                  const pct = cleared ? 100 : Math.min(100, Math.round((damage / activeDungeon.hp) * 100))
                  return (
                    <div key={kid.id}>
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-sm">{kid.avatar}</span>
                        <span className="text-xs text-white/60 font-semibold flex-1 truncate">{kid.name}</span>
                        {cleared
                          ? <span className="text-xs text-cq-forest font-bold">✓</span>
                          : <span className="text-xs text-white/30">{pct}%</span>
                        }
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
                        <motion.div
                          className="h-full rounded-full"
                          style={{ background: cleared ? '#4ade80' : 'linear-gradient(90deg, #38bdf8, #a78bfa)' }}
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.8, ease: 'easeOut' }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </motion.div>
          )}
        </div>
      )}

      {/* Kid columns */}
      <main className="cq-display-workspace relative z-10 flex-1 min-h-0 mx-4 sm:mx-8">
        <div className="cq-display-section-head">
          <div>
            <p className="cq-display-kicker">Adventurer boards</p>
            <h2>Today&apos;s quests</h2>
          </div>
          <p className="cq-display-section-note">Tap any quest to log a win</p>
        </div>
        <div
          className="realm-kid-grid grid gap-4 sm:gap-6 min-h-0"
          style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))' }}
        >
          {kids.map((kid, i) => (
            <motion.div
              key={kid.id}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.08, type: 'spring', stiffness: 220, damping: 24 }}
              className="min-h-0 flex flex-col"
            >
              <KidColumn
                kid={kid}
                quests={getKidPersonalQuests(kid)}
                completions={getKidCompletions(kid)}
                today={today}
                familySharedCompletions={familySharedCompletions}
                activeCurseCount={activeCurseCounts[kid.id] ?? 0}
                onComplete={(questId) => handleComplete(questId, kid.id)}
                linkToKidView
              />
            </motion.div>
          ))}
        </div>
      </main>

      {/* Bounty Board */}
      {bountyQuests.length > 0 && (
        <motion.section
          className="relative z-10 px-4 sm:px-8 pb-6 flex-shrink-0"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px" style={{ background: 'rgba(251,191,36,0.18)' }} />
            <span
              className="text-xs font-bold tracking-[0.2em] uppercase px-3 py-1 rounded-full flex-shrink-0"
              style={{
                background: 'rgba(251,191,36,0.1)',
                border: '1px solid rgba(251,191,36,0.25)',
                color: 'rgba(251,191,36,0.8)',
              }}
            >
              <span className="inline-flex items-center gap-1.5"><RealmIcon name="⚡" size={14} /> Bounty Board</span>
            </span>
            <div className="flex-1 h-px" style={{ background: 'rgba(251,191,36,0.18)' }} />
          </div>

          <div
            className="realm-bounty-grid grid gap-3"
            style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 160px), 1fr))' }}
          >
            {bountyQuests.map((quest, i) => {
              const count = getFamilyCount(quest)
              const isFull = count >= quest.slots
              const tier = TIER_CONFIG[quest.tier ?? 'normal']
              return (
                <motion.button
                  key={quest.id}
                  onClick={() => !isFull && setClaimingBounty(quest)}
                  disabled={isFull}
                  className="rounded-2xl p-4 text-left relative overflow-hidden"
                  style={{
                    background: isFull ? 'rgba(255,255,255,0.02)' : tier.bg,
                    border: `1px solid ${isFull ? 'rgba(255,255,255,0.06)' : tier.border}`,
                    boxShadow: isFull ? 'none' : (tier.glow ?? 'none'),
                    opacity: isFull ? 0.5 : 1,
                  }}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: isFull ? 0.5 : 1, y: 0 }}
                  transition={{ delay: 0.55 + i * 0.06 }}
                  whileHover={!isFull ? { scale: 1.02 } : {}}
                  whileTap={!isFull ? { scale: 0.97 } : {}}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: `${tier.color}18`, color: tier.color }}><RealmIcon name={quest.icon} size={22} /></span>
                    <div className="text-right">
                      <div className="flex items-center gap-1 justify-end">
                        <RealmIcon name="🪙" size={15} />
                        <span className="font-bold text-sm" style={{ color: isFull ? 'rgba(255,255,255,0.3)' : tier.color }}>
                          {quest.coins}
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className={`text-sm font-semibold leading-snug mb-2 ${isFull ? 'text-white/30' : 'text-white/90'}`}>
                    {quest.title}
                  </p>

                  <div className="flex items-center justify-between">
                    <span
                      className="text-xs px-1.5 py-0.5 rounded-md font-semibold"
                      style={{
                        background: `${tier.color}18`,
                        color: isFull ? 'rgba(255,255,255,0.25)' : tier.color,
                        border: `1px solid ${tier.color}30`,
                      }}
                    >
                      {tier.label}
                    </span>
                    <span className="text-xs" style={{ color: isFull ? 'rgba(74,222,128,0.7)' : 'rgba(255,255,255,0.4)' }}>
                      {isFull ? '✓ all claimed' : `${count}/${quest.slots} taken`}
                    </span>
                  </div>
                </motion.button>
              )
            })}
          </div>
        </motion.section>
      )}

      <motion.footer
        className="safe-bottom relative z-10 text-center text-white/50 text-xs tracking-[0.25em] uppercase flex-shrink-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9 }}
      >
        ✦ tap a quest to complete it ✦
      </motion.footer>

      {/* Bounty board modal */}
      <AnimatePresence>
        {showBounty && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowBounty(false)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="bounty-modal-title"
          >
            <motion.div
              ref={bountyTrapRef}
              className="modal-shell rounded-3xl w-full max-w-sm sm:max-w-2xl overflow-hidden"
              style={{
                background: 'rgba(10,6,28,0.98)',
                border: '1px solid rgba(251,191,36,0.25)',
                boxShadow: '0 0 80px rgba(0,0,0,0.7), 0 0 40px rgba(251,191,36,0.08)',
                maxHeight: '80vh',
                display: 'flex',
                flexDirection: 'column',
              }}
              initial={{ scale: 0.88, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.88, opacity: 0, y: 20 }}
              transition={{ type: 'spring', stiffness: 340, damping: 28 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-6 sm:px-7 pt-5 sm:pt-6 pb-4 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h2 id="bounty-modal-title" className="font-heading text-lg sm:text-xl font-bold text-white/90 tracking-wide inline-flex items-center gap-2"><RealmIcon name="⚡" size={19} /> Bounty Board</h2>
                    <p className="text-white/35 text-xs mt-0.5">First to claim earns the coins</p>
                  </div>
                  <button
                    onClick={() => setShowBounty(false)}
                    aria-label="Close bounty board"
                    className="w-11 h-11 rounded-full flex items-center justify-center text-white/35 hover:text-white/70 transition-all flex-shrink-0"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
                  >
                    <RealmIcon name="✗" size={17} />
                  </button>
                </div>
              </div>

              <div className="overflow-y-auto px-4 sm:px-7 py-4 flex-1 flex flex-col gap-3">
                {bountyQuests.map((quest) => {
                  const count = getFamilyCount(quest)
                  const isFull = count >= quest.slots
                  const tier = TIER_CONFIG[quest.tier ?? 'normal']
                  const isNormal = (quest.tier ?? 'normal') === 'normal'
                  return (
                    <motion.button
                      key={quest.id}
                      onClick={() => { if (!isFull) { setClaimingBounty(quest); setShowBounty(false) } }}
                      disabled={isFull}
                      className="flex items-center gap-4 rounded-2xl p-4 text-left w-full transition-all disabled:opacity-50"
                      style={{
                        background: isFull ? 'rgba(255,255,255,0.02)' : `rgba(${isNormal ? '251,191,36' : tier.color.replace('#','').match(/.{2}/g)?.map(h=>parseInt(h,16)).join(',') ?? '251,191,36'},0.06)`,
                        border: `1px solid ${isFull ? 'rgba(255,255,255,0.07)' : isNormal ? 'rgba(251,191,36,0.2)' : tier.border}`,
                      }}
                      whileHover={!isFull ? { scale: 1.01 } : {}}
                      whileTap={!isFull ? { scale: 0.99 } : {}}
                    >
                      <span className="h-12 w-12 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: `${tier.color}16`, color: tier.color }}><RealmIcon name={quest.icon} size={25} /></span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-white/90 truncate">{quest.title}</p>
                        <p className="text-xs mt-0.5" style={{ color: isFull ? 'rgba(74,222,128,0.7)' : 'rgba(255,255,255,0.4)' }}>
                          {isFull ? '✓ all claimed' : `${count}/${quest.slots} slots taken`}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <RealmIcon name="🪙" size={15} />
                        <span className="font-heading font-bold text-sm" style={{ color: isNormal ? '#fbbf24' : tier.color }}>
                          {quest.coins}
                        </span>
                      </div>
                      {!isFull && (
                        <span
                          className="text-xs px-3 py-1.5 rounded-xl font-semibold flex-shrink-0"
                          style={{ background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.3)', color: '#fbbf24' }}
                        >
                          Claim
                        </span>
                      )}
                    </motion.button>
                  )
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rewards quick-view modal */}
      <AnimatePresence>
        {showRewards && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowRewards(false)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="rewards-modal-title"
          >
            <motion.div
              ref={rewardsTrapRef}
              className="modal-shell rounded-3xl w-full max-w-sm sm:max-w-2xl overflow-hidden"
              style={{
                background: 'rgba(10,6,28,0.98)',
                border: '1px solid rgba(251,191,36,0.18)',
                boxShadow: '0 0 80px rgba(0,0,0,0.7), 0 0 40px rgba(251,191,36,0.06)',
                maxHeight: '80vh',
                display: 'flex',
                flexDirection: 'column',
              }}
              initial={{ scale: 0.88, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.88, opacity: 0, y: 20 }}
              transition={{ type: 'spring', stiffness: 340, damping: 28 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal header */}
              <div
                className="px-6 sm:px-7 pt-5 sm:pt-6 pb-4 flex-shrink-0"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h2 id="rewards-modal-title" className="font-heading text-lg sm:text-xl font-bold text-white/90 tracking-wide">
                      <span className="inline-flex items-center gap-2"><RealmIcon name="🏆" size={19} /> Reward Vault</span>
                    </h2>
                    <p className="text-white/35 text-xs mt-0.5">Spend your coins wisely, adventurer</p>
                  </div>
                  <button
                    onClick={() => setShowRewards(false)}
                    aria-label="Close reward vault"
                    className="w-11 h-11 rounded-full flex items-center justify-center text-white/35 hover:text-white/70 transition-all flex-shrink-0"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
                  >
                    <RealmIcon name="✗" size={17} />
                  </button>
                </div>
              </div>

              {/* Rewards list */}
              <div className="overflow-y-auto px-4 sm:px-7 py-4 flex-1 flex flex-col gap-3">
                {rewards.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-white/25">
                    <span className="h-14 w-14 rounded-2xl flex items-center justify-center mb-3" style={{ background: 'rgba(74,222,128,0.12)', color: '#4ade80' }}><RealmIcon name="🎁" size={29} /></span>
                    <p className="text-sm">No rewards set up yet</p>
                    <Link href="/parent" className="text-xs text-cq-gold/50 hover:text-cq-gold/80 mt-2 transition-all" onClick={() => setShowRewards(false)}>
                      Add rewards in the parent dashboard →
                    </Link>
                  </div>
                ) : (
                  rewards.map((reward, i) => (
                    <motion.div
                      key={reward.id}
                      className="flex items-center gap-4 rounded-2xl p-4"
                      style={{
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.07)',
                      }}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                    >
                      <span className="h-12 w-12 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(74,222,128,0.1)', color: '#4ade80' }}><RealmIcon name={reward.icon} size={24} /></span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white/88 leading-snug">{reward.title}</p>
                        {reward.description && (
                          <p className="text-xs text-white/35 mt-0.5 truncate">{reward.description}</p>
                        )}
                      </div>
                      <div className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
                        style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.22)' }}
                      >
                        <RealmIcon name="🪙" size={15} />
                        <span className="font-heading font-bold text-sm" style={{ color: '#fbbf24' }}>
                          {reward.cost}
                        </span>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>

              {/* Footer hint */}
              {rewards.length > 0 && (
                <div
                  className="px-7 py-4 flex-shrink-0 text-center"
                  style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <p className="text-white/25 text-xs">Visit your personal quest page to redeem rewards</p>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Kid picker modal for bounty claims */}
      <AnimatePresence>
        {claimingBounty && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setClaimingBounty(null)}
            role="dialog"
            aria-modal="true"
            aria-label="Choose adventurer for bounty"
          >
            <motion.div
              ref={claimTrapRef}
              className="modal-shell overflow-y-auto rounded-3xl p-5 sm:p-7 max-w-sm w-full"
              style={{
                background: 'rgba(12,8,32,0.97)',
                border: '1px solid rgba(255,255,255,0.1)',
                boxShadow: '0 0 60px rgba(0,0,0,0.6)',
              }}
              initial={{ scale: 0.88, opacity: 0, y: 16 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.88, opacity: 0, y: 16 }}
              transition={{ type: 'spring', stiffness: 340, damping: 28 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 justify-center mb-2">
                <span className="text-cq-azure inline-flex items-center justify-center"><RealmIcon name={claimingBounty.icon} size={30} /></span>
                <p className="font-heading font-bold text-lg text-white/90">{claimingBounty.title}</p>
              </div>
              <p className="text-center text-white/40 text-sm mb-6">Who&apos;s doing this bounty?</p>

              <div
                className="grid gap-3"
                style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(104px, 1fr))' }}
              >
                {kids.map(kid => {
                  const colors = KID_COLORS[kid.color]
                  return (
                    <motion.button
                      key={kid.id}
                      onClick={() => handleClaimBounty(claimingBounty.id, kid.id)}
                      className="min-h-24 flex flex-col items-center justify-center gap-2 px-3 py-4 rounded-2xl"
                      style={{ background: colors.bg, border: `1px solid ${colors.border}` }}
                      whileHover={{ scale: 1.06, boxShadow: `0 0 20px ${colors.glow}` }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <span className="text-4xl">{kid.avatar}</span>
                      <span className="text-sm font-bold" style={{ color: colors.primary }}>{kid.name}</span>
                    </motion.button>
                  )
                })}
              </div>

              <button
                onClick={() => setClaimingBounty(null)}
                className="mt-5 min-h-11 w-full rounded-xl text-center text-white/60 text-sm hover:text-white/90 transition-all"
              >
                Cancel
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
