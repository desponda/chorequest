'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { StarField } from '@/components/star-field'
import { KidColumn } from '@/components/kid-column'
import type { Kid, Quest, Completion, Family, Reward } from '@/lib/types'
import { KID_COLORS, TIER_CONFIG } from '@/lib/constants'
import { AppIcon } from '@/components/app-icon'
import { questDateString, questWeekKey } from '@/lib/utils'
import { toast } from 'sonner'

export default function WallDisplay() {
  const [family, setFamily] = useState<Family | null>(null)
  const [kids, setKids] = useState<Kid[]>([])
  const [quests, setQuests] = useState<Quest[]>([])
  const [completions, setCompletions] = useState<Completion[]>([])
  const [activeCurseCounts, setActiveCurseCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)
  const [claimingBounty, setClaimingBounty] = useState<Quest | null>(null)
  const [rewards, setRewards] = useState<Reward[]>([])
  const [showRewards, setShowRewards] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [supabase] = useState(createClient)

  const fetchData = useCallback(async () => {
    const { data: profile } = await supabase
      .from('profiles')
      .select('family_id')
      .single()

    if (!profile) return

    const [familyRes, kidsRes, questsRes, rewardsRes] = await Promise.all([
      supabase.from('families').select('id, name, invite_token, daily_reset_hour, created_at').eq('id', profile.family_id).single(),
      supabase.from('kids').select('id, name, avatar, color, coins, streak, last_completed_date, family_id, created_at').eq('family_id', profile.family_id).order('created_at'),
      supabase.from('quests').select('*').eq('family_id', profile.family_id).eq('active', true).order('created_at'),
      supabase.from('rewards').select('*').eq('available', true).order('cost'),
    ])

    const resetHour = familyRes.data?.daily_reset_hour ?? 0
    const today = questDateString(resetHour)
    const weekStart = questWeekKey(resetHour)

    const [completionsRes, cursesRes] = await Promise.all([
      supabase.from('completions').select('*').gte('date', weekStart).lte('date', today),
      supabase.from('curse_instances').select('kid_id').eq('status', 'active'),
    ])

    if (familyRes.data) setFamily({ ...familyRes.data, has_parent_pin: false })
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

    setLoading(false)
  }, [supabase])

  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth < 640)
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  useEffect(() => {
    fetchData()

    const channel = supabase
      .channel('wall-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'completions' }, fetchData)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'kids' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'curse_instances' }, fetchData)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetchData, supabase])

  const handleComplete = useCallback(
    async (questId: string, kidId: string) => {
      const quest = quests.find((q) => q.id === questId)
      if (!quest) return

      const today = questDateString(family?.daily_reset_hour ?? 0)

      if (quest.kind === 'shared') {
        const familyCount = completions.filter(c =>
          c.quest_id === questId &&
          (c.status === 'approved' || c.status === 'pending')
        ).length
        if (familyCount >= quest.slots) {
          toast.error('All slots claimed!')
          return
        }
      }

      const { error } = await supabase.from('completions').insert({
        quest_id: questId,
        kid_id: kidId,
        status: 'pending',
        date: today,
      })

      if (error) {
        toast.error(error.code === '23505' ? 'Already completed today!' : 'Something went wrong')
        return
      }

      toast.success(`Quest submitted! ✨`, {
        description: `${quest.coins} coins pending approval`,
      })

      await fetchData()
    },
    [quests, supabase, fetchData, family?.daily_reset_hour, completions]
  )

  const handleClaimBounty = useCallback(
    async (questId: string, kidId: string) => {
      await handleComplete(questId, kidId)
      setClaimingBounty(null)
    },
    [handleComplete]
  )

  const today = questDateString(family?.daily_reset_hour ?? 0)
  const dayOfWeek = new Date().getDay()

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

  const getFamilyCount = (questId: string) =>
    completions.filter(c =>
      c.quest_id === questId &&
      (c.status === 'approved' || c.status === 'pending')
    ).length

  const getKidCompletions = (kid: Kid) =>
    completions.filter((c) => c.kid_id === kid.id)

  const familySharedCompletions = completions.filter(c => {
    const q = quests.find(qq => qq.id === c.quest_id)
    return q?.kind === 'shared' || q?.kind === 'oneoff'
  })

  if (loading) {
    return (
      <div className="min-h-screen bg-quest-void flex items-center justify-center">
        <StarField />
        <motion.p
          className="relative z-10 font-heading text-3xl text-white/40"
          animate={{ opacity: [0.3, 0.8, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          ✦ Loading the realm ✦
        </motion.p>
      </div>
    )
  }

  if (kids.length === 0) {
    return (
      <div className="min-h-screen bg-quest-void flex items-center justify-center">
        <StarField />
        <motion.div
          className="relative z-10 text-center px-6 max-w-md"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <p className="text-7xl mb-6">🏰</p>
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
            ⚙️ Set Up Your Realm
          </Link>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-quest-void flex flex-col">
      <StarField />

      {/* Header */}
      <motion.header
        className="relative z-10 flex items-center justify-between px-4 sm:px-8 py-3 sm:py-5 flex-shrink-0"
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="flex-1" />

        <div className="text-center">
          <h1 className="font-heading text-2xl sm:text-4xl font-black text-gradient-gold tracking-widest">
            ChoreQuest
          </h1>
          {family && (
            <p className="hidden sm:block text-white/35 text-xs tracking-[0.3em] uppercase mt-1">
              The {family.name} Realm
            </p>
          )}
        </div>

        <div className="flex-1 flex justify-end items-center gap-2 sm:gap-3">
          <button
            onClick={() => setShowRewards(true)}
            className="flex items-center gap-1.5 px-2.5 sm:px-4 py-2 rounded-xl text-sm font-semibold transition-all"
            style={{
              background: 'rgba(251,191,36,0.08)',
              border: '1px solid rgba(251,191,36,0.2)',
              color: 'rgba(251,191,36,0.7)',
            }}
          >
            🎁<span className="hidden sm:inline"> Rewards</span>
          </button>
          {pendingCount > 0 && (
            <motion.div
              animate={{ scale: [1, 1.04, 1] }}
              transition={{ duration: 1.8, repeat: Infinity }}
            >
              <Link
                href="/parent"
                className="flex items-center gap-1.5 px-2.5 sm:px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                style={{
                  background: 'rgba(251, 191, 36, 0.14)',
                  border: '1px solid rgba(251, 191, 36, 0.32)',
                  color: '#fbbf24',
                }}
              >
                <span className="relative flex h-2 w-2 flex-shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cq-gold opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-cq-gold" />
                </span>
                <span className="hidden sm:inline">{pendingCount} pending</span>
              </Link>
            </motion.div>
          )}
          <Link
            href="/parent"
            className="px-2.5 sm:px-4 py-2 rounded-xl text-sm text-white/50 hover:text-white/80 transition-all glass border-glass"
          >
            ⚙️<span className="hidden sm:inline"> Parent</span>
          </Link>
        </div>
      </motion.header>

      {/* Kid columns */}
      <main
        className="relative z-10 flex-1 grid gap-4 sm:gap-6 px-4 sm:px-8 pb-4 min-h-0"
        style={{ gridTemplateColumns: `repeat(${isMobile ? 1 : kids.length}, 1fr)` }}
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
              ⚡ Bounty Board
            </span>
            <div className="flex-1 h-px" style={{ background: 'rgba(251,191,36,0.18)' }} />
          </div>

          <div
            className="grid gap-3"
            style={{ gridTemplateColumns: `repeat(${isMobile ? Math.min(bountyQuests.length, 2) : Math.min(bountyQuests.length, 4)}, 1fr)` }}
          >
            {bountyQuests.map((quest, i) => {
              const count = getFamilyCount(quest.id)
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
                    <AppIcon icon={quest.icon} size={22} color={isFull ? 'rgba(255,255,255,0.3)' : tier.color} />
                    <div className="text-right">
                      <div className="flex items-center gap-1 justify-end">
                        <span className="text-sm">🪙</span>
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
        className="relative z-10 text-center pb-4 text-white/20 text-xs tracking-[0.25em] uppercase flex-shrink-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9 }}
      >
        ✦ tap a quest to complete it ✦
      </motion.footer>

      {/* Rewards quick-view modal */}
      <AnimatePresence>
        {showRewards && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowRewards(false)}
          >
            <motion.div
              className="rounded-3xl mx-4 w-full max-w-sm sm:max-w-lg overflow-hidden"
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
                className="px-7 pt-6 pb-4 flex-shrink-0"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-heading text-xl font-bold text-white/90 tracking-wide">
                      🏆 Reward Vault
                    </h2>
                    <p className="text-white/35 text-xs mt-0.5">Spend your coins wisely, adventurer</p>
                  </div>
                  <button
                    onClick={() => setShowRewards(false)}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white/30 hover:text-white/60 transition-all"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Rewards list */}
              <div className="overflow-y-auto px-7 py-4 flex-1 flex flex-col gap-3">
                {rewards.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-white/25">
                    <span className="text-4xl mb-3">🎁</span>
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
                      <AppIcon icon={reward.icon} size={30} color="#fbbf24" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white/88 leading-snug">{reward.title}</p>
                        {reward.description && (
                          <p className="text-xs text-white/35 mt-0.5 truncate">{reward.description}</p>
                        )}
                      </div>
                      <div className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
                        style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.22)' }}
                      >
                        <span className="text-sm">🪙</span>
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
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setClaimingBounty(null)}
          >
            <motion.div
              className="rounded-3xl p-7 mx-4 max-w-sm w-full"
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
                <AppIcon icon={claimingBounty.icon} size={32} color={TIER_CONFIG[claimingBounty.tier ?? 'normal'].color} />
                <p className="font-heading font-bold text-lg text-white/90">{claimingBounty.title}</p>
              </div>
              <p className="text-center text-white/40 text-sm mb-6">Who&apos;s doing this bounty?</p>

              <div className="flex gap-4 justify-center">
                {kids.map(kid => {
                  const colors = KID_COLORS[kid.color]
                  return (
                    <motion.button
                      key={kid.id}
                      onClick={() => handleClaimBounty(claimingBounty.id, kid.id)}
                      className="flex flex-col items-center gap-2 px-6 py-4 rounded-2xl"
                      style={{ background: colors.bg, border: `1px solid ${colors.border}` }}
                      whileHover={{ scale: 1.06, boxShadow: `0 0 20px ${colors.glow}` }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <AppIcon icon={kid.avatar} size={40} color={colors.primary} />
                      <span className="text-sm font-bold" style={{ color: colors.primary }}>{kid.name}</span>
                    </motion.button>
                  )
                })}
              </div>

              <button
                onClick={() => setClaimingBounty(null)}
                className="mt-5 w-full text-center text-white/25 text-sm hover:text-white/50 transition-all"
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
