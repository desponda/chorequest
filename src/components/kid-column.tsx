'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import type { Kid, Quest, Completion } from '@/lib/types'
import { KID_COLORS } from '@/lib/constants'
import { CoinCounter } from './coin-counter'
import { StreakBadge } from './streak-badge'
import { QuestCard } from './quest-card'

interface KidColumnProps {
  kid: Kid
  quests: Quest[]
  completions: Completion[]
  today: string
  claimedExclusiveIds?: Set<string>
  activeCurseCount?: number
  onComplete?: (questId: string) => Promise<void>
  isParent?: boolean
  onApprove?: (completionId: string) => Promise<void>
  onReject?: (completionId: string) => Promise<void>
  linkToKidView?: boolean
}

export function KidColumn({
  kid,
  quests,
  completions,
  today,
  claimedExclusiveIds,
  activeCurseCount = 0,
  onComplete,
  isParent,
  onApprove,
  onReject,
  linkToKidView = true,
}: KidColumnProps) {
  const colors = KID_COLORS[kid.color]

  const getCompletion = (quest: Quest): Completion | undefined => {
    if (quest.frequency === 'weekly') {
      return completions.find(c => c.quest_id === quest.id && c.kid_id === kid.id)
    }
    return completions.find(c => c.quest_id === quest.id && c.kid_id === kid.id && c.date === today)
  }

  const getWeeklyCount = (quest: Quest): number =>
    completions.filter(c =>
      c.quest_id === quest.id &&
      c.kid_id === kid.id &&
      (c.status === 'approved' || c.status === 'pending')
    ).length

  const completedCount = quests.filter(quest => {
    if (quest.weekly_target != null) return getWeeklyCount(quest) >= quest.weekly_target
    return getCompletion(quest)?.status === 'approved'
  }).length
  const totalCount = quests.length
  const progress = totalCount > 0 ? completedCount / totalCount : 0

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Kid header card */}
      <motion.div
        className="rounded-3xl p-5 flex flex-col items-center gap-3"
        style={{
          background: colors.gradient,
          border: `1px solid ${colors.border}`,
          boxShadow: `0 0 40px ${colors.glow}, 0 0 0 1px ${colors.border}`,
          backdropFilter: 'blur(16px)',
        }}
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, type: 'spring', stiffness: 260, damping: 22 }}
      >
        {/* Avatar — links to kid's personal view */}
        {linkToKidView ? (
          <Link href={`/kid/${kid.id}`}>
            <motion.div
              className="relative cursor-pointer"
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.95 }}
            >
              <motion.span
                className="text-5xl block"
                animate={{ y: [0, -5, 0] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
              >
                {kid.avatar}
              </motion.span>
              <div
                className="absolute -inset-2 rounded-full -z-10 opacity-30 blur-md"
                style={{ background: colors.primary }}
              />
            </motion.div>
          </Link>
        ) : (
          <motion.span
            className="text-5xl block"
            animate={{ y: [0, -5, 0] }}
            transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            {kid.avatar}
          </motion.span>
        )}

        <div className="text-center">
          <h2 className="font-heading text-xl font-bold text-white/95 tracking-wide">
            {kid.name}
          </h2>
          <p className="text-xs mt-0.5 font-medium" style={{ color: colors.primary }}>
            Adventurer · Level {Math.floor(kid.coins / 50) + 1}
          </p>
        </div>

        <CoinCounter value={kid.coins} size="md" />

        <div className="flex items-center gap-2">
          {kid.streak > 1 && <StreakBadge streak={kid.streak} />}
          {activeCurseCount > 0 && (
            <motion.span
              className="text-xs px-2 py-0.5 rounded-full font-bold"
              style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.35)', color: '#f87171' }}
              animate={{ scale: [1, 1.06, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              ☠️ {activeCurseCount} curse{activeCurseCount > 1 ? 's' : ''}
            </motion.span>
          )}
        </div>

        {/* Progress bar */}
        {totalCount > 0 && (
          <div className="w-full">
            <div className="flex justify-between text-xs text-white/40 mb-1">
              <span>Today&apos;s quests</span>
              <span>{completedCount}/{totalCount}</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <motion.div
                className="h-full rounded-full"
                style={{ background: colors.primary }}
                initial={{ width: 0 }}
                animate={{ width: `${progress * 100}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            </div>
          </div>
        )}
      </motion.div>

      {/* Quest list */}
      <div className="flex flex-col gap-2.5 flex-1 overflow-y-auto scrollbar-thin-glass min-h-0 pb-1">
        {quests.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-white/25">
            <span className="text-3xl mb-2">🧙</span>
            <p className="text-sm">No quests yet</p>
          </div>
        ) : (
          quests.map((quest, i) => (
            <motion.div
              key={quest.id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.08 * i + 0.2, type: 'spring', stiffness: 300, damping: 28 }}
            >
              <QuestCard
                quest={quest}
                completion={getCompletion(quest)}
                weeklyCount={quest.weekly_target != null ? getWeeklyCount(quest) : undefined}
                isExclusiveLocked={quest.exclusive && !getCompletion(quest) && (claimedExclusiveIds?.has(quest.id) ?? false)}
                kidColor={kid.color}
                onComplete={onComplete ? () => onComplete(quest.id) : undefined}
                isParent={isParent}
                onApprove={onApprove}
                onReject={onReject}
              />
            </motion.div>
          ))
        )}
      </div>
    </div>
  )
}
