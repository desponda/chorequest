'use client'

export const dynamic = 'force-dynamic'

import { use, useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { StarField } from '@/components/star-field'
import { QuestCard } from '@/components/quest-card'
import { CoinCounter } from '@/components/coin-counter'
import { StreakBadge } from '@/components/streak-badge'
import { LoadingScreen } from '@/components/loading-screen'
import type { Kid, Quest, Completion, Reward, CurseInstance, Redemption } from '@/lib/types'
import { KID_COLORS, getLockDurationMs } from '@/lib/constants'
import { questDateString, questWeekKey } from '@/lib/utils'
import { isQuestVisibleToKid, kidHasActiveCompletion, sharedClaimedCount, kidCompletionForPeriod } from '@/lib/quest-rules'
import { toast } from 'sonner'
import { CoinLedger } from '@/components/coin-ledger'
import type { LedgerEntry } from '@/lib/ledger'

const PIN_SESSION_KEY = 'cq_kid_pin_'

interface KidDataPayload {
  kid: Kid
  resetHour: number
  quests: Quest[]
  completions: Completion[]
  rewards: Reward[]
  activeCurses: CurseInstance[]
  familySharedCompletions: Array<{ quest_id: string; kid_id: string; status: string; date: string }>
  pendingRedemptions: Redemption[]
}

export default function KidPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)

  const [data, setData] = useState<KidDataPayload | null>(null)
  const prevPendingIdsRef = useRef<string[]>([])
  const isFirstFetchRef = useRef(true)
  const [tab, setTab] = useState<'quests' | 'bounty' | 'rewards' | 'history'>('quests')
  const [pinVerified, setPinVerified] = useState(() =>
    typeof window !== 'undefined'
      ? sessionStorage.getItem(PIN_SESSION_KEY + id) === 'verified'
      : false
  )
  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState(false)
  const [pinAttempts, setPinAttempts] = useState(0)
  const [lockedUntil, setLockedUntil] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [loading, setLoading] = useState(true)
  const [supabase] = useState(createClient)

  const fetchData = useCallback(async () => {
    const res = await fetch(`/api/kid/${id}/data`)
    if (!res.ok) {
      setLoading(false)
      return
    }
    const payload: KidDataPayload = await res.json()
    setData(payload)

    const incoming = payload.pendingRedemptions ?? []
    if (!isFirstFetchRef.current) {
      const newIds = new Set(incoming.map((r) => r.id))
      const resolved = prevPendingIdsRef.current.filter((rid) => !newIds.has(rid))
      if (resolved.length > 0) {
        toast.success('🎉 Reward approved!', { description: 'Your balance has been updated' })
      }
    }
    isFirstFetchRef.current = false
    prevPendingIdsRef.current = incoming.map((r) => r.id)

    setLoading(false)
  }, [id])

  useEffect(() => {
    fetchData()

    const channel = supabase
      .channel(`kid-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'completions' }, fetchData)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'kids', filter: `id=eq.${id}` }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'curse_instances', filter: `kid_id=eq.${id}` }, fetchData)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'redemptions', filter: `kid_id=eq.${id}` }, fetchData)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetchData, id, supabase])

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
      const { success } = await res.json()
      if (success) {
        sessionStorage.setItem(PIN_SESSION_KEY + id, 'verified')
        setPinVerified(true)
        setPinError(false)
        setPinAttempts(0)
        setLockedUntil(null)
      } else {
        const attempts = pinAttempts + 1
        setPinAttempts(attempts)
        if (attempts >= 5) {
          setLockedUntil(now + getLockDurationMs(attempts))
        }
        setPinError(true)
        setTimeout(() => {
          setPinInput('')
          setPinError(false)
        }, 700)
      }
    }
  }, [lockedUntil, now, pinInput, pinAttempts, id])

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

      const today = questDateString(data.resetHour)
      const weekStart = questWeekKey(data.resetHour)

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
      const pendingTotal = (data.pendingRedemptions ?? []).filter(r => r.status === 'pending').reduce((sum, r) => sum + (r.reward?.cost ?? 0), 0)
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
      const res = await fetch(`/api/kid/${id}/redeem/${redemptionId}`, { method: 'DELETE' })
      if (!res.ok) {
        toast.error('Could not cancel request')
        return
      }
      toast.success('Request cancelled')
      await fetchData()
    },
    [id, fetchData]
  )

  if (loading || !data) {
    return <LoadingScreen />
  }

  const { kid, resetHour, quests, completions, rewards, activeCurses, familySharedCompletions } = data
  // Split by status: only pending counts against available coins; denied shown as history
  const pendingRedemptions = (data.pendingRedemptions ?? []).filter((r) => r.status === 'pending')
  const deniedRedemptions = (data.pendingRedemptions ?? []).filter((r) => r.status === 'denied')
  const today = questDateString(resetHour)
  const weekStart = questWeekKey(resetHour)
  const colors = KID_COLORS[kid.color]
  const pendingTotal = pendingRedemptions.reduce((sum, r) => sum + (r.reward?.cost ?? 0), 0)
  const availableCoins = Math.max(0, kid.coins - pendingTotal)
  const pendingCompletions = completions.filter(c => c.status === 'pending')

  // PIN screen
  if (!pinVerified) {
    return (
      <div className="min-h-screen bg-quest-void flex items-center justify-center px-4">
        <StarField />
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
            {kid.avatar}
          </motion.span>
          <h2 className="font-heading text-3xl font-bold text-white mb-1">{kid.name}</h2>
          {lockedUntil && now < lockedUntil ? (
            <p className="text-red-400 text-sm mb-8">
              🔒 Too many attempts — try again in{' '}
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
            className="mt-8 inline-block text-white/25 text-sm hover:text-white/50 transition-all"
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

  return (
    <div className="min-h-screen bg-quest-void flex flex-col">
      <StarField />

      <div className="relative z-10 flex flex-col flex-1 w-full max-w-md mx-auto">
        <motion.header
          className="flex items-center gap-4 px-6 py-5 flex-shrink-0"
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Link href="/display" className="text-white/40 hover:text-white/70 transition-all text-sm">
            ← Realm
          </Link>

          <div className="flex-1 flex items-center gap-3 justify-center">
            <span className="text-3xl">{kid.avatar}</span>
            <div>
              <h1 className="font-heading text-2xl font-bold text-white/95">{kid.name}</h1>
              <p className="text-xs" style={{ color: colors.primary }}>Level {Math.floor(kid.coins / 50) + 1} Adventurer</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {kid.streak > 1 && <StreakBadge streak={kid.streak} compact />}
            <CoinCounter value={availableCoins} size="sm" />
          </div>
        </motion.header>

        <div className="flex px-6 gap-2 mb-4 flex-shrink-0">
          {(['quests', 'bounty', 'rewards', 'history'] as const).map((t) => {
            const labels = { quests: '⚔️ Quests', bounty: '⚡ Bounty', rewards: '🎁 Rewards', history: '📒 History' }
            const badge = t === 'quests' && pendingCompletions.length > 0
              ? pendingCompletions.length
              : t === 'bounty' && availableBountyCount > 0
              ? availableBountyCount
              : null
            const isBountyActive = t === 'bounty' && tab === 'bounty'
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="relative flex-1 py-2 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-1.5"
                style={{
                  background: tab === t
                    ? (t === 'bounty' ? 'rgba(251,191,36,0.12)' : colors.bg)
                    : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${tab === t
                    ? (t === 'bounty' ? 'rgba(251,191,36,0.35)' : colors.border)
                    : 'rgba(255,255,255,0.07)'}`,
                  color: tab === t
                    ? (t === 'bounty' ? '#fbbf24' : colors.primary)
                    : 'rgba(255,255,255,0.45)',
                }}
              >
                {labels[t]}
                {badge && (
                  <span
                    className="px-1.5 py-0.5 rounded-full text-[10px] font-bold leading-none"
                    style={{ background: 'rgba(251,191,36,0.9)', color: '#0a0620' }}
                  >
                    {badge}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        <main className="flex-1 px-6 pb-8 overflow-y-auto scrollbar-thin-glass">
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
                  <Section title={`Today (${personalDailyDoneCount}/${personalDaily.length})`}>
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
                  <Section title={`This Week (${personalWeeklyDoneCount}/${personalWeekly.length})`}>
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
                    <p className="text-amber-400 text-sm font-bold">🎉 All caught up — check the Bounty Board ⚡</p>
                  </motion.button>
                )}

                {visibleQuests.length === 0 && (
                  <div className="text-center py-16 text-white/30">
                    <p className="text-4xl mb-3">🧙</p>
                    <p>No quests yet — ask a parent to add some!</p>
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
              <HistoryTab key="history" kidId={id} kidColor={kid.color} />
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

function Section({ title, accent, children }: { title: string; accent?: 'gold'; children: React.ReactNode }) {
  return (
    <div>
      <p
        className="text-xs font-bold uppercase tracking-widest mb-2"
        style={{ color: accent === 'gold' ? 'rgba(251,191,36,0.7)' : 'rgba(255,255,255,0.35)' }}
      >
        {title}
      </p>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
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
      <p className="text-xs font-bold uppercase tracking-widest text-red-400/80">⚠️ Afflictions</p>
      {curses.map(ci => {
        const curse = ci.curse as { title: string; icon: string; penalty: number } | undefined
        return (
          <div key={ci.id} className="flex items-center gap-3">
            <span className="text-xl">{curse?.icon ?? '☠️'}</span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-300">{curse?.title ?? 'Curse'}</p>
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
        <span className="text-2xl">🪙</span>
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
          <p className="text-xs font-bold uppercase tracking-widest text-amber-400/55">⏳ Awaiting Approval</p>
          {pendingRedemptions.map((r) => (
            <div key={r.id} className="flex items-center gap-3">
              <span className="text-lg">{r.reward?.icon ?? '🎁'}</span>
              <p className="flex-1 text-sm text-white/70">{r.reward?.title ?? 'Reward'}</p>
              <span className="text-xs text-white/35">🪙 {r.reward?.cost ?? '?'}</span>
              <button
                onClick={() => onCancel(r.id)}
                className="text-xs text-white/25 hover:text-red-400 transition-all flex-shrink-0 px-1.5 py-0.5 rounded-lg"
                title="Cancel request"
              >
                ✕
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
          <p className="text-xs font-bold uppercase tracking-widest text-red-400/55">✗ Not approved</p>
          {deniedRedemptions.map((r) => (
            <div key={r.id} className="flex items-center gap-3 opacity-60">
              <span className="text-lg">{r.reward?.icon ?? '🎁'}</span>
              <p className="flex-1 text-sm text-white/50 line-through">{r.reward?.title ?? 'Reward'}</p>
              <span className="text-xs text-red-400/60">✗ denied</span>
            </div>
          ))}
        </div>
      )}

      {rewards.length === 0 ? (
        <div className="text-center py-16 text-white/30">
          <p className="text-4xl mb-3">🎁</p>
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
            <span className="text-3xl">{reward.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-white/90">{reward.title}</p>
              {reward.description && (
                <p className="text-white/45 text-sm truncate">{reward.description}</p>
              )}
            </div>
            <button
              onClick={() => onRedeem(reward.id)}
              disabled={availableCoins < reward.cost}
              className="flex-shrink-0 px-4 py-2 rounded-xl text-sm font-bold transition-all disabled:opacity-40"
              style={{
                background: availableCoins >= reward.cost
                  ? 'rgba(251, 191, 36, 0.18)'
                  : 'rgba(255,255,255,0.05)',
                border: `1px solid ${availableCoins >= reward.cost ? 'rgba(251, 191, 36, 0.4)' : 'rgba(255,255,255,0.08)'}`,
                color: availableCoins >= reward.cost ? '#fbbf24' : 'rgba(255,255,255,0.4)',
              }}
            >
              🪙 {reward.cost}
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
          ⏳
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
              <span className="text-lg flex-shrink-0">{quest.icon}</span>
              <span className="text-sm text-white/80 font-medium flex-1 truncate">{quest.title}</span>
              <span className="text-xs text-amber-400/70 flex-shrink-0">🪙 {quest.coins}</span>
              <button
                onClick={() => onUndo(c.id)}
                className="text-xs text-white/30 hover:text-amber-400 transition-all flex-shrink-0 px-2 py-1 rounded-lg"
                style={{ background: 'rgba(255,255,255,0.04)' }}
                title="Cancel submission"
              >
                ↩ undo
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
        <p className="text-4xl mb-3">⚡</p>
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
        className="rounded-2xl px-4 py-3 flex items-center gap-3"
        style={{ background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.2)' }}
      >
        <span className="text-xl">⚡</span>
        <p className="text-xs text-amber-400/70">First to claim earns the coins — slots are limited</p>
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

function HistoryTab({ kidId, kidColor }: { kidId: string; kidColor: 'azure' | 'mystic' }) {
  const [ledger, setLedger] = useState<LedgerEntry[]>([])
  const [balance, setBalance] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/kid/${kidId}/ledger`)
      .then(r => r.json())
      .then(d => {
        setLedger(d.ledger ?? [])
        setBalance(d.currentBalance ?? 0)
      })
      .finally(() => setLoading(false))
  }, [kidId])

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

  return (
    <motion.div
      key="history"
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      transition={{ duration: 0.2 }}
    >
      <CoinLedger ledger={ledger} currentBalance={balance} kidColor={kidColor} />
    </motion.div>
  )
}
