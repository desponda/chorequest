'use client'

export const dynamic = 'force-dynamic'

import { use, useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { QuestCard } from '@/components/quest-card'
import { CoinCounter } from '@/components/coin-counter'
import { StreakBadge } from '@/components/streak-badge'
import { KidViewSkeleton } from '@/components/skeletons'
import type { Kid, Quest, Completion, Reward, CurseInstance, Redemption } from '@/lib/types'
import { KID_COLORS } from '@/lib/constants'
import { questDateStringForZone, questWeekKeyForZone } from '@/lib/utils'
import { isQuestVisibleToKid, kidHasActiveCompletion, sharedClaimedCount, kidCompletionForPeriod } from '@/lib/quest-rules'
import { toast } from 'sonner'
import { CoinLedger } from '@/components/coin-ledger'
import type { LedgerEntry, PendingLedgerEntry } from '@/lib/ledger'
import { getLevelTitle, getXPProgress } from '@/lib/xp'
import { classifyRedemptionChanges } from '@/lib/redemption-notifications'
import { RealmIcon } from '@/components/ui/realm-icon'

const PIN_SESSION_KEY = 'cq_kid_pin_'
type KidTab = 'quests' | 'bounty' | 'rewards' | 'history'
const KID_TAB_ORDER: KidTab[] = ['quests', 'bounty', 'rewards', 'history']

interface KidDataPayload {
  kid: Kid
  resetHour: number
  timeZone: string
  quests: Quest[]
  completions: Completion[]
  rewards: Reward[]
  activeCurses: CurseInstance[]
  familySharedCompletions: Array<{ quest_id: string; kid_id: string; status: string; date: string }>
  pendingRedemptions: Redemption[]
}

type PublicKidProfile = Pick<Kid, 'id' | 'name' | 'avatar' | 'color'>

function lockedPayload(kid: PublicKidProfile): KidDataPayload {
  return {
    kid: {
      ...kid,
      family_id: '',
      coins: 0,
      streak: 0,
      last_completed_date: null,
      xp: 0,
      level: 1,
      created_at: '',
    },
    resetHour: 0,
    timeZone: 'UTC',
    quests: [],
    completions: [],
    rewards: [],
    activeCurses: [],
    familySharedCompletions: [],
    pendingRedemptions: [],
  }
}

export default function KidPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)

  const [data, setData] = useState<KidDataPayload | null>(null)
  const prevPendingIdsRef = useRef<string[]>([])
  const locallyCancelledRedemptionIdsRef = useRef(new Set<string>())
  const isFirstFetchRef = useRef(true)
  const [tab, setTab] = useState<KidTab>('quests')
  const tabRefs = useRef<Partial<Record<KidTab, HTMLButtonElement | null>>>({})

  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, current: KidTab) => {
    const currentIndex = KID_TAB_ORDER.indexOf(current)
    let nextIndex = currentIndex

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (currentIndex + 1) % KID_TAB_ORDER.length
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (currentIndex - 1 + KID_TAB_ORDER.length) % KID_TAB_ORDER.length
    else if (event.key === 'Home') nextIndex = 0
    else if (event.key === 'End') nextIndex = KID_TAB_ORDER.length - 1
    else return

    event.preventDefault()
    const next = KID_TAB_ORDER[nextIndex]
    setTab(next)
    tabRefs.current[next]?.focus()
  }
  const [pinVerified, setPinVerified] = useState(() =>
    typeof window !== 'undefined'
      ? sessionStorage.getItem(PIN_SESSION_KEY + id) === 'verified'
      : false
  )
  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState(false)
  const [lockedUntil, setLockedUntil] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [loading, setLoading] = useState(true)
  const [supabase] = useState(createClient)

  const fetchData = useCallback(async () => {
    const res = await fetch(`/api/kid/${id}/data`)
    if (!res.ok) {
      if (res.status === 401) {
        sessionStorage.removeItem(PIN_SESSION_KEY + id)
        setPinVerified(false)
        setData(null)
      }
      setLoading(false)
      return
    }
    const payload: KidDataPayload = await res.json()
    setData(payload)

    const incoming = payload.pendingRedemptions ?? []
    const changes = classifyRedemptionChanges(
      prevPendingIdsRef.current,
      incoming,
      locallyCancelledRedemptionIdsRef.current,
    )
    if (!isFirstFetchRef.current) {
      if (changes.approvedIds.length > 0) {
        toast.success('🎉 Reward approved!', { description: 'Your balance has been updated' })
      }
      if (changes.deniedIds.length > 0) {
        toast.error('Reward request denied', { description: 'Your reserved coins are available again' })
      }
    }
    isFirstFetchRef.current = false
    prevPendingIdsRef.current = changes.pendingIds
    for (const id of locallyCancelledRedemptionIdsRef.current) {
      if (!changes.pendingIds.includes(id)) locallyCancelledRedemptionIdsRef.current.delete(id)
    }

    setLoading(false)
  }, [id])

  useEffect(() => {
    if (pinVerified) return
    let cancelled = false
    setLoading(true)
    fetch(`/api/kid/${id}/profile`)
      .then(async (res) => res.ok ? res.json() as Promise<{ kid: PublicKidProfile }> : null)
      .then((payload) => {
        if (!cancelled && payload?.kid) setData(lockedPayload(payload.kid))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [id, pinVerified])

  useEffect(() => {
    if (!pinVerified) return
    setLoading(true)
    fetchData()

    const channel = supabase
      .channel(`kid-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'completions' }, fetchData)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'kids', filter: `id=eq.${id}` }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'curse_instances', filter: `kid_id=eq.${id}` }, fetchData)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'redemptions', filter: `kid_id=eq.${id}` }, fetchData)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetchData, id, pinVerified, supabase])

  useEffect(() => {
    if (!lockedUntil) return
    const timerId = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timerId)
  }, [lockedUntil])

  const handlePinDigit = useCallback(async (digit: string) => {
    if (lockedUntil && now < lockedUntil) return
    const next = pinInput + digit
    setPinInput(next)
    if (next.length === 4) {
      const res = await fetch(`/api/kid/${id}/verify-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: next }),
      })
      const { success, retryAfter } = await res.json() as { success?: boolean; retryAfter?: number }
      if (success) {
        sessionStorage.setItem(PIN_SESSION_KEY + id, 'verified')
        setLoading(true)
        setPinVerified(true)
        setPinError(false)
        setLockedUntil(null)
      } else {
        if (retryAfter && retryAfter > 0) setLockedUntil(Date.now() + retryAfter * 1000)
        setPinError(true)
        setTimeout(() => {
          setPinInput('')
          setPinError(false)
        }, 700)
      }
    }
  }, [lockedUntil, now, pinInput, id])

  useEffect(() => {
    if (pinVerified) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') handlePinDigit(e.key)
      if (e.key === 'Backspace' || e.key === 'Delete') {
        setPinInput((p) => p.slice(0, -1))
        setPinError(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [pinVerified, handlePinDigit])

  const handleComplete = useCallback(
    async (questId: string) => {
      if (!data) return
      const quest = data.quests.find((q) => q.id === questId)
      if (!quest) return

      const today = questDateStringForZone(data.resetHour, data.timeZone)
      const weekStart = questWeekKeyForZone(data.resetHour, data.timeZone)

      // For shared quests, double-check slot availability before posting
      if (quest.kind === 'shared') {
        const left = quest.slots - sharedClaimedCount(quest, data.familySharedCompletions as Completion[], today, weekStart)
        if (left <= 0) {
          toast.error('All slots claimed for this period!')
          return
        }
      }
      const res = await fetch(`/api/kid/${id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quest_id: questId, date: today }),
      })

      if (!res.ok) {
        const { error } = await res.json().catch(() => ({}))
        toast.error(error === '23505' ? 'Already done!' : 'Something went wrong')
        return
      }

      toast.success(`Quest submitted! ✨`, { description: `+${quest.coins} coins once approved` })
      await fetchData()
    },
    [data, id, fetchData]
  )

  const handleRedeem = useCallback(
    async (rewardId: string) => {
      if (!data) return
      const reward = data.rewards.find((r) => r.id === rewardId)
      if (!reward) return

      // Only count pending (not denied) against available coins
      const pendingTotal = (data.pendingRedemptions ?? []).filter(r => r.status === 'pending').reduce((sum, r) => sum + (r.cost_charged ?? r.reward?.cost ?? 0), 0)
      const available = Math.max(0, data.kid.coins - pendingTotal)

      if (available < reward.cost) {
        toast.error(`Need ${reward.cost - available} more coins!`)
        return
      }

      const res = await fetch(`/api/kid/${id}/redeem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reward_id: rewardId }),
      })

      if (!res.ok) {
        const { error } = await res.json().catch(() => ({}))
        toast.error(error === 'Insufficient coins' ? 'Not enough coins!' : 'Could not redeem reward')
        return
      }

      toast.success(`Reward requested! 🎁`, { description: 'Ask a parent to approve it' })
      await fetchData()
    },
    [data, id, fetchData]
  )

  const handleUndo = useCallback(
    async (completionId: string) => {
      const res = await fetch(`/api/kid/${id}/complete/${completionId}`, { method: 'DELETE' })
      if (!res.ok) {
        toast.error('Could not undo — already reviewed?')
        return
      }
      toast.success('Quest cancelled')
      await fetchData()
    },
    [id, fetchData]
  )

  const handleCancelRedemption = useCallback(
    async (redemptionId: string) => {
      locallyCancelledRedemptionIdsRef.current.add(redemptionId)
      const res = await fetch(`/api/kid/${id}/redeem/${redemptionId}`, { method: 'DELETE' })
      if (!res.ok) {
        locallyCancelledRedemptionIdsRef.current.delete(redemptionId)
        toast.error('Could not cancel request')
        return
      }
      toast.success('Request cancelled')
      await fetchData()
    },
    [id, fetchData]
  )

  if (loading || !data) {
    return <KidViewSkeleton />
  }

  const { kid, resetHour, timeZone, quests, completions, rewards, activeCurses, familySharedCompletions } = data
  // Split by status: only pending counts against available coins; denied shown as history
  const pendingRedemptions = (data.pendingRedemptions ?? []).filter((r) => r.status === 'pending')
  const deniedRedemptions = (data.pendingRedemptions ?? []).filter((r) => r.status === 'denied')
  const today = questDateStringForZone(resetHour, timeZone)
  const weekStart = questWeekKeyForZone(resetHour, timeZone)
  const colors = KID_COLORS[kid.color]
  const xpProgress = getXPProgress(kid.xp ?? 0)
  const pendingTotal = pendingRedemptions.reduce((sum, r) => sum + (r.cost_charged ?? r.reward?.cost ?? 0), 0)
  const availableCoins = Math.max(0, kid.coins - pendingTotal)
  const pendingCompletions = completions.filter(c => c.status === 'pending')

  // PIN screen
  if (!pinVerified) {
    return (
      <div className="min-h-screen cq-page-shell flex items-start sm:items-center justify-center px-4 py-6 overflow-y-auto safe-top safe-bottom">
        <motion.div
          className="relative z-10 w-full max-w-xs text-center"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <motion.span
            className="block mb-4"
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          >
            <RealmIcon name={kid.avatar} size={42} />
          </motion.span>
          <h2 className="font-heading text-3xl font-bold text-white mb-1">{kid.name}</h2>
          {lockedUntil && now < lockedUntil ? (
            <p className="text-red-400 text-sm mb-8">
              <RealmIcon name="🔒" size={14} /> Too many attempts — try again in{' '}
              {Math.ceil((lockedUntil - now) / 1000)}s
            </p>
          ) : (
            <p className="text-white/40 text-sm mb-8" style={{ color: colors.primary }}>
              Enter your secret PIN
            </p>
          )}

          <div className="flex justify-center gap-4 mb-8">
            {Array.from({ length: 4 }, (_, i) => (
              <motion.div
                key={i}
                className="w-4 h-4 rounded-full border-2"
                style={{
                  borderColor: pinError ? '#f87171' : colors.border,
                  background: pinInput.length > i
                    ? (pinError ? '#f87171' : colors.primary)
                    : 'transparent',
                }}
                animate={pinError ? { x: [-4, 4, -4, 4, 0] } : {}}
                transition={{ duration: 0.3 }}
              />
            ))}
          </div>

          <div className="grid grid-cols-3 gap-3 max-w-[240px] mx-auto">
            {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((d) => (
              <motion.button
                key={d}
                onClick={() => {
                  if (d === '⌫') {
                    setPinInput((p) => p.slice(0, -1))
                    setPinError(false)
                  } else if (d && pinInput.length < 4) {
                    handlePinDigit(d)
                  }
                }}
                disabled={!d}
                aria-label={d === '⌫' ? 'Delete last digit' : d || undefined}
                className="h-14 rounded-2xl font-heading font-bold text-xl transition-all disabled:opacity-0"
                style={{
                  background: d ? 'rgba(255,255,255,0.06)' : 'transparent',
                  border: d ? '1px solid rgba(255,255,255,0.09)' : 'none',
                  color: d === '⌫' ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.85)',
                }}
                whileHover={d ? { background: `rgba(${kidColorRgb(kid.color)}, 0.12)` } : {}}
                whileTap={d ? { scale: 0.93 } : {}}
              >
                {d}
              </motion.button>
            ))}
          </div>

          <Link
            href="/display"
            className="mt-8 inline-flex min-h-11 items-center rounded-xl px-3 text-white/60 text-sm hover:text-white/90 transition-all"
          >
            ← Back to realm
          </Link>
        </motion.div>
      </div>
    )
  }

  // ─── Quest categorization ────────────────────────────────────────────────
  const approvedOnceIds = new Set(
    completions.filter((c) => c.status === 'approved').map((c) => c.quest_id),
  )
  const visibleQuests = quests.filter((q) =>
    isQuestVisibleToKid(q, kid.id, today, approvedOnceIds),
  )

  const personalDaily = visibleQuests.filter((q) => q.kind === 'personal' && q.frequency === 'daily')
  const personalWeekly = visibleQuests.filter((q) => q.kind === 'personal' && q.frequency === 'weekly')
  const upForGrabs = visibleQuests.filter((q) => q.kind === 'shared' || q.kind === 'oneoff')

  const personalDailyDoneCount = personalDaily.filter((q) =>
    completions.some((c) => c.quest_id === q.id && c.date === today && (c.status === 'approved' || c.status === 'pending')),
  ).length
  const allDailiesDone = personalDaily.length > 0 && personalDailyDoneCount === personalDaily.length

  const personalWeeklyDoneCount = personalWeekly.filter((q) =>
    kidHasActiveCompletion(q, kid.id, completions),
  ).length

  const availableBountyCount = upForGrabs.filter((q) => {
    const claimed = sharedClaimedCount(q, familySharedCompletions as Completion[], today, weekStart)
    const myCompletion = kidCompletionForPeriod(q, kid.id, completions, today, weekStart)
    return !myCompletion && claimed < q.slots
  }).length
  const hasQuestTabContent =
    pendingCompletions.length > 0 ||
    activeCurses.length > 0 ||
    personalDaily.length > 0 ||
    personalWeekly.length > 0

  return (
    <div className="min-h-screen cq-page-shell flex flex-col">

      <div className="workspace-frame workspace-frame-kid relative z-10 flex flex-col flex-1">
        <motion.header
          className="cq-kid-hero safe-top px-4 py-4 sm:px-6 sm:py-5 flex-shrink-0"
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center justify-between gap-3">
            <Link
              href="/display"
              className="cq-kid-hero-back min-h-11 inline-flex items-center gap-1.5 rounded-xl px-2 text-sm text-white/65 transition-all hover:text-white"
            >
              <RealmIcon name="←" size={15} /> Realm
            </Link>
            <span className="cq-kid-hero-kicker hidden min-[420px]:inline-flex">Today&apos;s adventure</span>
            <div className="flex items-center gap-2 sm:gap-3">
              {kid.streak > 1 && <StreakBadge streak={kid.streak} compact />}
              <span className="cq-kid-coin-summary"><CoinCounter value={availableCoins} size="sm" /></span>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              <span
                className="cq-kid-avatar-large flex-shrink-0"
                style={{ background: `${colors.primary}18`, borderColor: colors.border, color: colors.primary }}
              >
                <RealmIcon name={kid.avatar} size={30} />
              </span>
              <div className="min-w-0">
                <p className="cq-kid-hero-label">{getLevelTitle(kid.level ?? 1)} · Level {kid.level ?? 1}</p>
                <h1 className="cq-kid-hero-title truncate">{kid.name}&apos;s quest board</h1>
                <p className="text-sm text-white/55 truncate">Pick a quest, make progress, earn the next reward.</p>
              </div>
            </div>
            <div className="cq-kid-progress-summary flex-shrink-0">
              <span className="text-xs uppercase tracking-[0.16em] text-white/45">Today</span>
              <strong style={{ color: colors.primary }}>{personalDailyDoneCount}/{personalDaily.length || 0}</strong>
              <span className="text-xs text-white/50">quests complete</span>
            </div>
          </div>

          <div className="mt-5">
            <div className="flex items-center justify-between gap-3 text-xs text-white/55">
              <span>Level progress</span>
              <span className="tabular-nums">{xpProgress.currentXP}/{xpProgress.neededXP} XP</span>
            </div>
            <div
              className="cq-kid-progress-track mt-2"
              role="progressbar"
              aria-label="Level progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(xpProgress.pct)}
            >
              <span style={{ width: `${xpProgress.pct}%`, background: colors.primary }} />
            </div>
            <div className="mt-2 flex items-center justify-between gap-3 text-[11px] text-white/40">
              <span>{xpProgress.pct}% to the next level</span>
              <span>{availableCoins.toLocaleString()} coins ready to spend</span>
            </div>
          </div>
        </motion.header>

        <div
          className="cq-kid-nav workspace-tabs grid grid-cols-4 mx-4 sm:mx-6 gap-1.5 sm:gap-2 mb-4 flex-shrink-0"
          role="tablist"
          aria-label="Adventurer sections"
        >
          {(['quests', 'bounty', 'rewards', 'history'] as const).map((t) => {
            const labels = {
              quests: { icon: '⚔️', label: 'Quests' },
              bounty: { icon: '⚡', label: 'Bounty' },
              rewards: { icon: '🎁', label: 'Rewards' },
              history: { icon: '📒', label: 'History' },
            }
            const badge = t === 'quests' && pendingCompletions.length > 0
              ? pendingCompletions.length
              : t === 'bounty' && availableBountyCount > 0
              ? availableBountyCount
              : null
            return (
              <button
                key={t}
                ref={(node) => { tabRefs.current[t] = node }}
                onClick={() => setTab(t)}
                onKeyDown={(event) => handleTabKeyDown(event, t)}
                role="tab"
                id={`kid-tab-${t}`}
                aria-controls={`kid-panel-${t}`}
                aria-selected={tab === t}
                aria-label={`${t.charAt(0).toUpperCase()}${t.slice(1)}`}
                tabIndex={tab === t ? 0 : -1}
                className="kid-workspace-tab relative min-w-0 min-h-11 sm:min-h-12 px-1.5 sm:px-3 py-2 rounded-xl text-[11px] sm:text-sm font-semibold transition-all flex items-center justify-center gap-1.5"
                style={{
                  background: tab === t ? (t === 'bounty' ? 'rgba(251,191,36,0.14)' : colors.bg) : 'transparent',
                  border: `1px solid ${tab === t ? (t === 'bounty' ? 'rgba(251,191,36,0.35)' : colors.border) : 'transparent'}`,
                  color: tab === t
                    ? (t === 'bounty' ? '#fbbf24' : colors.primary)
                    : 'rgba(255,255,255,0.58)',
                }}
              >
                <span aria-hidden="true"><RealmIcon name={labels[t].icon} size={17} /></span>
                <span>{labels[t].label}</span>
                {badge && (
                  <span
                    className="kid-tab-badge px-1.5 py-0.5 rounded-full text-[10px] font-bold leading-none"
                    style={{ background: 'rgba(251,191,36,0.9)', color: '#0a0620' }}
                    aria-label={`${badge} new`}
                  >
                    {badge}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        <main
          id={`kid-panel-${tab}`}
          role="tabpanel"
          aria-labelledby={`kid-tab-${tab}`}
          className="workspace-main workspace-main-kid flex-1 px-4 sm:px-6 pb-8 overflow-y-auto scrollbar-thin-glass safe-bottom"
        >
          <AnimatePresence mode="wait">
            {tab === 'quests' ? (
              <motion.div
                key="quests"
                className="flex flex-col gap-5"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.2 }}
              >
                {pendingCompletions.length > 0 && (
                  <PendingApprovalSection
                    pendingCompletions={pendingCompletions}
                    quests={quests}
                    onUndo={handleUndo}
                  />
                )}

                {activeCurses.length > 0 && <ActiveCursesSection curses={activeCurses} />}

                {personalDaily.length > 0 && (
                  <Section
                    title="Today"
                    icon="📅"
                    subtitle="Small wins that keep your momentum moving"
                    progress={`${personalDailyDoneCount}/${personalDaily.length}`}
                  >
                    {personalDaily.map((q, i) => {
                      const c = completions.find((c) => c.quest_id === q.id && c.date === today)
                      return (
                        <QuestRowItem
                          key={q.id}
                          quest={q}
                          index={i}
                          completion={c}
                          kidColor={kid.color}
                          onComplete={() => handleComplete(q.id)}
                          onUndo={c?.status === 'pending' ? () => handleUndo(c.id) : undefined}
                        />
                      )
                    })}
                  </Section>
                )}

                {personalWeekly.length > 0 && (
                  <Section
                    title="This week"
                    icon="🎯"
                    subtitle="Bigger quests with room to breathe"
                    progress={`${personalWeeklyDoneCount}/${personalWeekly.length}`}
                  >
                    {personalWeekly.map((q, i) => {
                      const c = completions.find((c) => c.quest_id === q.id && c.kid_id === kid.id && c.date >= weekStart)
                      return (
                        <QuestRowItem
                          key={q.id}
                          quest={q}
                          index={i}
                          completion={c}
                          kidColor={kid.color}
                          onComplete={() => handleComplete(q.id)}
                          onUndo={c?.status === 'pending' ? () => handleUndo(c.id) : undefined}
                        />
                      )
                    })}
                  </Section>
                )}

                {allDailiesDone && availableBountyCount > 0 && (
                  <motion.button
                    onClick={() => setTab('bounty')}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full rounded-2xl p-3 text-center"
                    style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)' }}
                  >
                    <p className="text-amber-400 text-sm font-bold inline-flex items-center justify-center gap-1.5"><RealmIcon name="✨" size={15} /> All caught up — check the Bounty Board <RealmIcon name="⚡" size={15} /></p>
                  </motion.button>
                )}

                {!hasQuestTabContent && (
                  <div className="text-center py-16 text-white/30">
                    <div className="h-14 w-14 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ background: `${colors.primary}16`, color: colors.primary }}><RealmIcon name="🧙" size={29} /></div>
                    <p>
                      {availableBountyCount > 0
                        ? 'No personal quests right now.'
                        : 'No quests yet — ask a parent to add some!'}
                    </p>
                    {availableBountyCount > 0 && (
                      <button
                        type="button"
                        onClick={() => setTab('bounty')}
                        className="mt-4 min-h-[44px] px-4 rounded-xl text-sm font-bold text-amber-400"
                        style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)' }}
                      >
                        View {availableBountyCount === 1 ? 'Bounty' : `${availableBountyCount} Bounties`}
                      </button>
                    )}
                  </div>
                )}
              </motion.div>
            ) : tab === 'bounty' ? (
              <BountyTab
                key="bounty"
                quests={upForGrabs}
                kid={kid}
                completions={completions}
                familySharedCompletions={familySharedCompletions}
                today={today}
                weekStart={weekStart}
                onComplete={handleComplete}
                onUndo={handleUndo}
              />
            ) : tab === 'history' ? (
              <HistoryTab key="history" kidId={id} timeZone={timeZone} />
            ) : (
              <RewardsTab
                rewards={rewards}
                kid={kid}
                pendingRedemptions={pendingRedemptions}
                deniedRedemptions={deniedRedemptions}
                pendingTotal={pendingTotal}
                availableCoins={availableCoins}
                onRedeem={handleRedeem}
                onCancel={handleCancelRedemption}
              />
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function Section({
  title,
  icon,
  subtitle,
  progress,
  accent,
  children,
}: {
  title: string
  icon?: string
  subtitle?: string
  progress?: string
  accent?: 'gold'
  children: React.ReactNode
}) {
  return (
    <section className="cq-board-section" data-section={title}>
      <div className="cq-board-section-header">
        <div className="flex min-w-0 items-center gap-3">
          {icon && (
            <span className="cq-board-section-icon" style={{ color: accent === 'gold' ? '#fbbf24' : 'rgba(255,255,255,0.72)' }} aria-hidden="true">
              <RealmIcon name={icon} size={18} />
            </span>
          )}
          <div className="min-w-0">
            <h2 className="text-base font-extrabold text-white/90">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-white/48 truncate">{subtitle}</p>}
          </div>
        </div>
        {progress && (
          <span className="cq-board-section-progress" style={{ color: accent === 'gold' ? '#fbbf24' : 'rgba(255,255,255,0.68)' }}>
            {progress} complete
          </span>
        )}
      </div>
      <div className="cq-board-quest-list">{children}</div>
    </section>
  )
}

function QuestRowItem({
  quest, index, completion, sharedClaimed, isShareLocked, kidColor, onComplete, onUndo,
}: {
  quest: Quest
  index: number
  completion?: Completion
  sharedClaimed?: number
  isShareLocked?: boolean
  kidColor: 'azure' | 'mystic'
  onComplete: () => Promise<void>
  onUndo?: () => Promise<void>
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
    >
      <QuestCard
        quest={quest}
        completion={completion}
        sharedClaimed={sharedClaimed}
        isShareLocked={isShareLocked}
        kidColor={kidColor}
        onComplete={onComplete}
        onUndo={onUndo}
      />
    </motion.div>
  )
}

function ActiveCursesSection({ curses }: { curses: CurseInstance[] }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl p-4 flex flex-col gap-2"
      style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}
    >
      <p className="text-xs font-bold uppercase tracking-widest text-red-400/80 inline-flex items-center gap-1.5"><RealmIcon name="🌩️" size={14} /> Coin adjustments</p>
      {curses.map(ci => {
        const curse = ci.curse as { title: string; icon: string; penalty: number } | undefined
        return (
          <div key={ci.id} className="flex items-center gap-3">
            <span className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171' }}><RealmIcon name={curse?.icon ?? '☠️'} size={18} /></span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-300">{curse?.title ?? 'Adjustment'}</p>
              <p className="text-xs text-red-400/60">−{ci.coins_deducted} coins deducted</p>
            </div>
          </div>
        )
      })}
    </motion.div>
  )
}

function RewardsTab({
  rewards, kid, pendingRedemptions, deniedRedemptions, pendingTotal, availableCoins, onRedeem, onCancel,
}: {
  rewards: Reward[]
  kid: Kid
  pendingRedemptions: Redemption[]
  deniedRedemptions: Redemption[]
  pendingTotal: number
  availableCoins: number
  onRedeem: (rewardId: string) => Promise<void>
  onCancel: (redemptionId: string) => Promise<void>
}) {
  return (
    <motion.div
      key="rewards"
      className="flex flex-col gap-3"
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      transition={{ duration: 0.2 }}
    >
      <div
        className="rounded-2xl p-4 mb-2 flex items-center gap-3"
        style={{ background: 'rgba(251, 191, 36, 0.08)', border: '1px solid rgba(251, 191, 36, 0.2)' }}
      >
        <span className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(251,191,36,0.12)', color: '#fbbf24' }}><RealmIcon name="🪙" size={22} /></span>
        <div className="flex-1">
          <p className="text-white/70 text-sm">{pendingTotal > 0 ? 'Available coins' : 'Your coin balance'}</p>
          <p className="font-heading text-2xl font-bold text-cq-gold">{availableCoins.toLocaleString()}</p>
          {pendingTotal > 0 && (
            <p className="text-xs text-amber-400/55 mt-0.5">
              {kid.coins.toLocaleString()} total · {pendingTotal.toLocaleString()} pending approval
            </p>
          )}
        </div>
      </div>

      {pendingRedemptions.length > 0 && (
        <div
          className="rounded-2xl p-4 mb-2 flex flex-col gap-2"
          style={{ background: 'rgba(251, 191, 36, 0.04)', border: '1px solid rgba(251, 191, 36, 0.15)' }}
        >
          <p className="text-xs font-bold uppercase tracking-widest text-amber-400/55 inline-flex items-center gap-1.5"><RealmIcon name="⏳" size={14} /> Awaiting Approval</p>
          {pendingRedemptions.map((r) => (
            <div key={r.id} className="flex items-center gap-3">
              <span className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(74,222,128,0.1)', color: '#4ade80' }}><RealmIcon name={r.reward?.icon ?? '🎁'} size={17} /></span>
              <p className="flex-1 text-sm text-white/70">{r.reward?.title ?? 'Reward'}</p>
              <span className="text-xs text-white/35 inline-flex items-center gap-1"><RealmIcon name="🪙" size={12} /> {r.reward?.cost ?? '?'}</span>
              <button
                onClick={() => onCancel(r.id)}
                className="min-h-11 min-w-11 inline-flex items-center justify-center text-xs text-white/55 hover:text-red-400 transition-all flex-shrink-0 rounded-xl"
                title="Cancel request"
                aria-label={`Cancel ${r.reward?.title ?? 'reward'} request`}
              >
                <RealmIcon name="✗" size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {deniedRedemptions.length > 0 && (
        <div
          className="rounded-2xl p-4 mb-2 flex flex-col gap-2"
          style={{ background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.15)' }}
        >
          <p className="text-xs font-bold uppercase tracking-widest text-red-400/55 inline-flex items-center gap-1.5"><RealmIcon name="✗" size={14} /> Not approved</p>
          {deniedRedemptions.map((r) => (
            <div key={r.id} className="flex items-center gap-3 opacity-60">
              <span className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171' }}><RealmIcon name={r.reward?.icon ?? '🎁'} size={17} /></span>
              <p className="flex-1 text-sm text-white/50 line-through">{r.reward?.title ?? 'Reward'}</p>
              <span className="text-xs text-red-400/60">✗ denied</span>
            </div>
          ))}
        </div>
      )}

      {rewards.length === 0 ? (
        <div className="text-center py-16 text-white/30">
          <div className="h-14 w-14 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ background: 'rgba(74,222,128,0.1)', color: '#4ade80' }}><RealmIcon name="🎁" size={29} /></div>
          <p>No rewards yet — ask a parent to add some!</p>
        </div>
      ) : (
        rewards.map((reward, i) => (
          <motion.div
            key={reward.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="rounded-2xl p-4 flex items-center gap-4"
            style={{
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <span className="h-12 w-12 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(74,222,128,0.1)', color: '#4ade80' }}><RealmIcon name={reward.icon} size={24} /></span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-white/90">{reward.title}</p>
              {reward.description && (
                <p className="text-white/45 text-sm truncate">{reward.description}</p>
              )}
            </div>
            <button
              onClick={() => onRedeem(reward.id)}
              disabled={availableCoins < reward.cost}
              className="min-h-11 flex-shrink-0 px-4 py-2 rounded-xl text-sm font-bold transition-all disabled:opacity-40"
              style={{
                background: availableCoins >= reward.cost
                  ? 'rgba(251, 191, 36, 0.18)'
                  : 'rgba(255,255,255,0.05)',
                border: `1px solid ${availableCoins >= reward.cost ? 'rgba(251, 191, 36, 0.4)' : 'rgba(255,255,255,0.08)'}`,
                color: availableCoins >= reward.cost ? '#fbbf24' : 'rgba(255,255,255,0.4)',
              }}
            >
              <span className="inline-flex items-center gap-1.5"><RealmIcon name="🪙" size={15} /> {reward.cost}</span>
            </button>
          </motion.div>
        ))
      )}
    </motion.div>
  )
}

function PendingApprovalSection({
  pendingCompletions,
  quests,
  onUndo,
}: {
  pendingCompletions: Completion[]
  quests: Quest[]
  onUndo: (completionId: string) => Promise<void>
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl overflow-hidden"
      style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.22)' }}
    >
      <div className="px-4 pt-3 pb-2 flex items-center gap-2">
        <motion.span
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.6, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' }}
          className="text-base"
        >
          <RealmIcon name="⏳" size={16} />
        </motion.span>
        <p className="text-xs font-bold uppercase tracking-widest text-amber-400/80">
          Waiting for approval · {pendingCompletions.length}
        </p>
      </div>
      <div className="flex flex-col divide-y" style={{ borderColor: 'rgba(251,191,36,0.1)' }}>
        {pendingCompletions.map(c => {
          const quest = quests.find(q => q.id === c.quest_id)
          if (!quest) return null
          return (
            <div key={c.id} className="flex items-center gap-3 px-4 py-2.5">
              <span className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(251,191,36,0.1)', color: '#fbbf24' }}><RealmIcon name={quest.icon} size={17} /></span>
              <span className="text-sm text-white/80 font-medium flex-1 truncate">{quest.title}</span>
              <span className="text-xs text-amber-400/70 flex-shrink-0 inline-flex items-center gap-1"><RealmIcon name="🪙" size={12} /> {c.coins_requested ?? quest.coins}</span>
              <button
                onClick={() => onUndo(c.id)}
                className="min-h-11 min-w-11 inline-flex items-center justify-center text-xs text-white/60 hover:text-amber-400 transition-all flex-shrink-0 px-2 rounded-lg"
                style={{ background: 'rgba(255,255,255,0.04)' }}
                title="Cancel submission"
              >
                <span className="inline-flex items-center gap-1.5"><RealmIcon name="↩" size={14} /> undo</span>
              </button>
            </div>
          )
        })}
      </div>
    </motion.div>
  )
}

function BountyTab({
  quests,
  kid,
  completions,
  familySharedCompletions,
  today,
  weekStart,
  onComplete,
  onUndo,
}: {
  quests: Quest[]
  kid: Kid
  completions: Completion[]
  familySharedCompletions: Array<{ quest_id: string; kid_id: string; status: string; date: string }>
  today: string
  weekStart: string
  onComplete: (questId: string) => Promise<void>
  onUndo: (completionId: string) => Promise<void>
}) {
  if (quests.length === 0) {
    return (
      <motion.div
        key="bounty"
        className="text-center py-16 text-white/30"
        initial={{ opacity: 0, x: 10 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -10 }}
        transition={{ duration: 0.2 }}
      >
        <div className="h-14 w-14 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ background: 'rgba(251,191,36,0.12)', color: '#fbbf24' }}><RealmIcon name="⚡" size={29} /></div>
        <p>No bounties right now — check back soon!</p>
      </motion.div>
    )
  }

  return (
    <motion.div
      key="bounty"
      className="flex flex-col gap-3"
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      transition={{ duration: 0.2 }}
    >
      <div
        className="rounded-2xl px-4 py-3 sm:px-5 sm:py-4 flex items-center gap-3.5"
        style={{ background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.2)' }}
      >
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl" style={{ background: 'rgba(251,191,36,0.12)', color: '#fbbf24' }}><RealmIcon name="⚡" size={21} /></span>
        <div className="min-w-0">
          <h2 className="text-xs font-bold uppercase tracking-widest text-amber-300">Bounty board</h2>
          <p className="mt-0.5 text-sm text-amber-100/75">First to claim earns the coins. Available slots are limited.</p>
        </div>
      </div>

      {quests.map((q, i) => {
        const claimed = sharedClaimedCount(q, familySharedCompletions as Completion[], today, weekStart)
        const myCompletion = kidCompletionForPeriod(q, kid.id, completions, today, weekStart)
        const isShareLocked = !myCompletion && claimed >= q.slots
        return (
          <QuestRowItem
            key={q.id}
            quest={q}
            index={i}
            completion={myCompletion}
            sharedClaimed={claimed}
            isShareLocked={isShareLocked}
            kidColor={kid.color}
            onComplete={() => onComplete(q.id)}
            onUndo={myCompletion?.status === 'pending' ? () => onUndo(myCompletion.id) : undefined}
          />
        )
      })}
    </motion.div>
  )
}

function kidColorRgb(color: string) {
  return color === 'azure' ? '56,189,248' : '167,139,250'
}

function HistoryTab({ kidId, timeZone }: { kidId: string; timeZone?: string }) {
  const [ledger, setLedger] = useState<LedgerEntry[]>([])
  const [pending, setPending] = useState<PendingLedgerEntry[]>([])
  const [balance, setBalance] = useState(0)
  const [availableBalance, setAvailableBalance] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)

    void (async () => {
      try {
        const response = await fetch(`/api/kid/${kidId}/ledger`, { signal: controller.signal })
        const data = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(data.error ?? 'Could not load coin history')
        setLedger(data.ledger ?? [])
        setPending(data.pending ?? [])
        setBalance(data.currentBalance ?? 0)
        setAvailableBalance(data.availableBalance ?? data.currentBalance ?? 0)
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setError(loadError instanceof Error ? loadError.message : 'Could not load coin history')
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    })()

    return () => controller.abort()
  }, [kidId, reloadKey])

  if (loading) {
    return (
      <motion.div
        key="history"
        className="flex items-center justify-center py-16"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        <motion.p
          className="font-heading text-xl text-white/30"
          animate={{ opacity: [0.3, 0.7, 0.3] }}
          transition={{ duration: 1.6, repeat: Infinity }}
        >
          ✦ Loading ✦
        </motion.p>
      </motion.div>
    )
  }

  if (error) {
    return (
      <motion.div
        key="history-error"
        className="flex flex-col items-center justify-center py-16 text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        role="alert"
      >
        <p className="text-sm font-semibold text-red-200">Couldn&apos;t load coin history</p>
        <p className="text-xs text-white/60 mt-1">{error}</p>
        <button
          type="button"
          onClick={() => setReloadKey((value) => value + 1)}
          className="min-h-11 mt-4 px-4 rounded-xl text-sm font-bold text-cq-gold"
          style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.25)' }}
        >
          Try again
        </button>
      </motion.div>
    )
  }

  return (
    <motion.div
      key="history"
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      transition={{ duration: 0.2 }}
    >
      <CoinLedger
        ledger={ledger}
        pending={pending}
        currentBalance={balance}
        availableBalance={availableBalance}
        timeZone={timeZone}
        onRefresh={() => setReloadKey((value) => value + 1)}
      />
    </motion.div>
  )
}
