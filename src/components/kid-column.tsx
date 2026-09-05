'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import type { Kid, Quest, Completion } from '@/lib/types'
import { KID_COLORS } from '@/lib/constants'
import { getXPProgress, getLevelTitle } from '@/lib/xp'
import { CoinCounter } from './coin-counter'
import { StreakBadge } from './streak-badge'
import { QuestCard } from './quest-card'
import { RealmIcon } from './ui/realm-icon'

interface KidColumnProps {
  kid: Kid
  quests: Quest[]
  completions: Completion[]
  today: string
  /** Family-wide completions for shared quests, used to count remaining slots and lock when full. */
  familySharedCompletions?: Array<{ quest_id: string; kid_id: string; status: string }>
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
  familySharedCompletions = [],
  activeCurseCount = 0,
  onComplete,
  isParent,
  onApprove,
  onReject,
  linkToKidView = true,
}: KidColumnProps) {
  const colors = KID_COLORS[kid.color]
  const xpInfo = getXPProgress(kid.xp ?? 0)

  const getCompletion = (quest: Quest): Completion | undefined => {
    if (quest.frequency === 'weekly') {
      return completions.find(c => c.quest_id === quest.id && c.kid_id === kid.id)
    }
    return completions.find(c => c.quest_id === quest.id && c.kid_id === kid.id && c.date === today)
  }

  const sharedClaimCount = (quest: Quest): number =>
    familySharedCompletions.filter(c =>
      c.quest_id === quest.id && (c.status === 'approved' || c.status === 'pending'),
    ).length

  const completedCount = quests.filter(quest => {
    if (quest.kind === 'shared') return sharedClaimCount(quest) >= quest.slots
    return getCompletion(quest)?.status === 'approved'
  }).length
  const totalCount = quests.length

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Kid summary */}
      <motion.div
        className="cq-kid-summary rounded-2xl p-4"
        style={{
          border: `1px solid ${colors.border}`,
          boxShadow: `0 12px 30px ${colors.glow}`,
        }}
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, type: 'spring', stiffness: 260, damping: 22 }}
      >
        <div className="flex items-center gap-3">
          {/* Avatar — links to kid's personal view */}
          {linkToKidView ? (
            <Link href={`/kid/${kid.id}`} aria-label={`Open ${kid.name}'s quest board`}>
              <motion.span
                className="cq-avatar-medallion h-14 w-14 rounded-2xl flex items-center justify-center cursor-pointer"
                style={{ color: colors.primary, borderColor: colors.border }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.96 }}
              >
                <RealmIcon name={kid.avatar} size={30} />
              </motion.span>
            </Link>
          ) : (
            <span className="cq-avatar-medallion h-14 w-14 rounded-2xl flex items-center justify-center" style={{ color: colors.primary, borderColor: colors.border }}>
              <RealmIcon name={kid.avatar} size={30} />
            </span>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 min-w-0">
              <h2 className="font-heading text-xl font-bold text-white/95 tracking-wide truncate">
                {kid.name}
              </h2>
              {kid.streak > 1 && <StreakBadge streak={kid.streak} compact />}
            </div>
            <p className="text-xs mt-0.5 font-medium" style={{ color: colors.primary }}>
              {getLevelTitle(kid.level ?? 1)} · Lv {kid.level ?? 1}
            </p>
            <div className="mt-2"><CoinCounter value={kid.coins} size="sm" /></div>
          </div>
        </div>

        {/* Progress summary */}
        <div className="mt-4 grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 items-end">
          <div>
            <div className="flex justify-between text-xs text-white/55 mb-1">
              <span>Level progress</span>
              <span>{xpInfo.currentXP}/{xpInfo.neededXP} XP</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <motion.div
                className="h-full rounded-full"
                style={{ background: `linear-gradient(90deg, ${colors.primary}, #fbbf24)` }}
                initial={{ width: 0 }}
                animate={{ width: `${xpInfo.pct}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            </div>
          </div>
          {totalCount > 0 && (
            <div className="text-right text-xs text-white/55">
              <span className="block text-white/80 font-bold">{completedCount}/{totalCount}</span>
              <span>today</span>
            </div>
          )}
        </div>

        {activeCurseCount > 0 && (
          <motion.span
            className="text-xs px-2 py-0.5 rounded-full font-bold"
            style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.35)', color: '#f87171' }}
            animate={{ scale: [1, 1.06, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <span className="inline-flex items-center gap-1.5"><RealmIcon name="☠️" size={14} /> {activeCurseCount} curse{activeCurseCount > 1 ? 's' : ''}</span>
          </motion.span>
        )}

      </motion.div>

      {/* Quest list */}
      <div className="cq-display-quest-panel flex flex-col flex-1 min-h-0">
        <div className="cq-display-quest-heading">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="cq-display-quest-heading-icon" aria-hidden="true"><RealmIcon name="📜" size={17} /></span>
            <div className="min-w-0">
              <p className="cq-display-kicker">Personal quests</p>
              <p className="cq-display-quest-label">{totalCount === 1 ? '1 quest' : `${totalCount} quests`} on the board</p>
            </div>
          </div>
          {totalCount > 0 && <span className="cq-display-quest-count">{completedCount}/{totalCount} cleared</span>}
        </div>
        {(() => {
        // Personal-kind quests live in the per-kid column. Shared/oneoff are surfaced on the bounty board.
        const personalQuests = quests.filter(q => q.kind === 'personal')
        let cardIndex = 0

        const renderCard = (quest: Quest) => {
          const i = cardIndex++
          return (
            <motion.div
              key={quest.id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.08 * i + 0.2, type: 'spring', stiffness: 300, damping: 28 }}
            >
              <QuestCard
                quest={quest}
                completion={getCompletion(quest)}
                kidColor={kid.color}
                onComplete={onComplete ? () => onComplete(quest.id) : undefined}
                isParent={isParent}
                onApprove={onApprove}
                onReject={onReject}
                displayMode
              />
            </motion.div>
          )
        }

        if (personalQuests.length === 0) {
          return (
            <div className="flex flex-col gap-2.5 flex-1 overflow-y-auto scrollbar-thin-glass min-h-0 pb-1">
              <div className="flex flex-col items-center justify-center h-32 text-white/25">
                <span className="h-11 w-11 rounded-2xl flex items-center justify-center mb-2" style={{ background: `${colors.primary}16`, color: colors.primary }}>
                  <RealmIcon name="🧙" size={24} />
                </span>
                <p className="text-sm">No quests yet</p>
              </div>
            </div>
          )
        }

        return (
          <div className="flex flex-col gap-2.5 flex-1 overflow-y-auto scrollbar-thin-glass min-h-0 pb-1">
            {personalQuests.map(renderCard)}
          </div>
        )
        })()}
      </div>
    </div>
  )
}
