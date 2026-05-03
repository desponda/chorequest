'use client'

export const dynamic = 'force-dynamic'

import { use, useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { StarField } from '@/components/star-field'
import { QuestCard } from '@/components/quest-card'
import { CoinCounter } from '@/components/coin-counter'
import { StreakBadge } from '@/components/streak-badge'
import type { Kid, Quest, Completion, Reward } from '@/lib/types'
import { KID_COLORS } from '@/lib/constants'
import { toast } from 'sonner'

const PIN_SESSION_KEY = 'cq_kid_pin_'

export default function KidPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)

  const [kid, setKid] = useState<Kid | null>(null)
  const [quests, setQuests] = useState<Quest[]>([])
  const [completions, setCompletions] = useState<Completion[]>([])
  const [rewards, setRewards] = useState<Reward[]>([])
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
  const [tab, setTab] = useState<'quests' | 'rewards'>('quests')
  const [supabase] = useState(createClient)
  const today = new Date().toISOString().split('T')[0]

  const fetchData = useCallback(async () => {
    const [kidRes, questsRes, completionsRes, rewardsRes] = await Promise.all([
      supabase.from('kids').select('id, name, avatar, color, coins, streak, last_completed_date, family_id, created_at').eq('id', id).single(),
      supabase.from('quests').select('*').eq('active', true).order('created_at'),
      supabase.from('completions').select('*').eq('kid_id', id),
      supabase.from('rewards').select('*').eq('available', true),
    ])

    if (kidRes.data) setKid(kidRes.data)
    if (questsRes.data) {
      const allCompletions: Completion[] = completionsRes.data ?? []
      const approvedOnceIds = new Set(
        allCompletions
          .filter((c: Completion) => c.status === 'approved')
          .map((c: Completion) => c.quest_id)
      )
      setQuests(
        questsRes.data.filter((q: Quest) => {
          if (q.assigned_to && q.assigned_to !== id) return false
          if (q.frequency === 'once' && approvedOnceIds.has(q.id)) return false
          return true
        })
      )
    }
    if (completionsRes.data) setCompletions(completionsRes.data)
    if (rewardsRes.data) setRewards(rewardsRes.data)
    setLoading(false)
  }, [id, supabase])

  useEffect(() => {
    fetchData()

    const channel = supabase
      .channel(`kid-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'completions', filter: `kid_id=eq.${id}` }, fetchData)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'kids', filter: `id=eq.${id}` }, fetchData)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetchData, id, supabase])

  useEffect(() => {
    if (!lockedUntil) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [lockedUntil])

  const handlePinDigit = async (digit: string) => {
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
          const lockMs = attempts >= 8 ? 5 * 60_000 : 30_000
          setLockedUntil(now + lockMs)
        }
        setPinError(true)
        setTimeout(() => {
          setPinInput('')
          setPinError(false)
        }, 700)
      }
    }
  }

  const handleComplete = useCallback(
    async (questId: string) => {
      const quest = quests.find((q) => q.id === questId)
      if (!quest) return

      const { error } = await supabase.from('completions').insert({
        quest_id: questId,
        kid_id: id,
        status: 'pending',
        date: new Date().toISOString().split('T')[0],
      })

      if (error) {
        toast.error(error.code === '23505' ? 'Already done today!' : 'Something went wrong')
        return
      }

      toast.success(`Quest submitted! ✨`, { description: `+${quest.coins} coins once approved` })
      await fetchData()
    },
    [quests, id, supabase, fetchData]
  )

  const handleRedeem = useCallback(
    async (rewardId: string) => {
      const reward = rewards.find((r) => r.id === rewardId)
      if (!reward || !kid) return

      if (kid.coins < reward.cost) {
        toast.error(`Need ${reward.cost - kid.coins} more coins!`)
        return
      }

      const { error } = await supabase.from('redemptions').insert({
        reward_id: rewardId,
        kid_id: id,
        status: 'pending',
      })

      if (error) {
        toast.error('Could not redeem reward')
        return
      }

      toast.success(`Reward requested! 🎁`, { description: 'Ask a parent to approve it' })
    },
    [rewards, kid, id, supabase]
  )

  if (loading || !kid) {
    return (
      <div className="min-h-screen bg-quest-void flex items-center justify-center">
        <StarField />
        <motion.p
          className="relative z-10 font-heading text-2xl text-white/40"
          animate={{ opacity: [0.3, 0.8, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          ✦ Loading ✦
        </motion.p>
      </div>
    )
  }

  const colors = KID_COLORS[kid.color]

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
            className="text-6xl block mb-4"
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

          {/* PIN dots */}
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

          {/* Numpad */}
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
                whileHover={d ? { background: `rgba(${kidColor(kid.color)}, 0.12)` } : {}}
                whileTap={d ? { scale: 0.93 } : {}}
              >
                {d}
              </motion.button>
            ))}
          </div>

          <Link
            href="/"
            className="mt-8 inline-block text-white/25 text-sm hover:text-white/50 transition-all"
          >
            ← Back to realm
          </Link>
        </motion.div>
      </div>
    )
  }

  // Kid's quest board
  return (
    <div className="min-h-screen bg-quest-void flex flex-col">
      <StarField />

      <div className="relative z-10 flex flex-col flex-1 w-full max-w-md mx-auto">
      {/* Header */}
      <motion.header
        className="flex items-center gap-4 px-6 py-5 flex-shrink-0"
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Link href="/" className="text-white/40 hover:text-white/70 transition-all text-sm">
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
          <CoinCounter value={kid.coins} size="sm" />
        </div>
      </motion.header>

      {/* Tab bar */}
      <div className="flex px-6 gap-2 mb-4 flex-shrink-0">
        {(['quests', 'rewards'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-5 py-2 rounded-xl text-sm font-semibold capitalize transition-all"
            style={{
              background: tab === t ? colors.bg : 'rgba(255,255,255,0.04)',
              border: `1px solid ${tab === t ? colors.border : 'rgba(255,255,255,0.07)'}`,
              color: tab === t ? colors.primary : 'rgba(255,255,255,0.45)',
            }}
          >
            {t === 'quests' ? '⚔️ Quests' : '🎁 Rewards'}
          </button>
        ))}
      </div>

      {/* Content */}
      <main className="flex-1 px-6 pb-8 overflow-y-auto scrollbar-thin-glass">
        <AnimatePresence mode="wait">
          {tab === 'quests' ? (
            <motion.div
              key="quests"
              className="flex flex-col gap-3"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.2 }}
            >
              {quests.length === 0 ? (
                <div className="text-center py-16 text-white/30">
                  <p className="text-4xl mb-3">🧙</p>
                  <p>No quests yet — ask a parent to add some!</p>
                </div>
              ) : (
                quests.map((quest, i) => {
                  const completion = quest.frequency === 'once'
                    ? completions.find((c) => c.quest_id === quest.id)
                    : completions.find((c) => c.quest_id === quest.id && c.date === today)
                  return (
                    <motion.div
                      key={quest.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.06 }}
                    >
                      <QuestCard
                        quest={quest}
                        completion={completion}
                        kidColor={kid.color}
                        onComplete={() => handleComplete(quest.id)}
                      />
                    </motion.div>
                  )
                })
              )}
            </motion.div>
          ) : (
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
                style={{
                  background: 'rgba(251, 191, 36, 0.08)',
                  border: '1px solid rgba(251, 191, 36, 0.2)',
                }}
              >
                <span className="text-2xl">🪙</span>
                <div>
                  <p className="text-white/70 text-sm">Your coin balance</p>
                  <p className="font-heading text-2xl font-bold text-cq-gold">{kid.coins.toLocaleString()}</p>
                </div>
              </div>

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
                      onClick={() => handleRedeem(reward.id)}
                      disabled={kid.coins < reward.cost}
                      className="flex-shrink-0 px-4 py-2 rounded-xl text-sm font-bold transition-all disabled:opacity-40"
                      style={{
                        background: kid.coins >= reward.cost
                          ? 'rgba(251, 191, 36, 0.18)'
                          : 'rgba(255,255,255,0.05)',
                        border: `1px solid ${kid.coins >= reward.cost ? 'rgba(251, 191, 36, 0.4)' : 'rgba(255,255,255,0.08)'}`,
                        color: kid.coins >= reward.cost ? '#fbbf24' : 'rgba(255,255,255,0.4)',
                      }}
                    >
                      🪙 {reward.cost}
                    </button>
                  </motion.div>
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      </div>
    </div>
  )
}

function kidColor(color: string) {
  return color === 'azure' ? '56,189,248' : '167,139,250'
}
