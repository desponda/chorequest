'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Quest, Completion, KidColor } from '@/lib/types'
import { KID_COLORS, TIER_CONFIG } from '@/lib/constants'
import { CoinBurst } from './coin-burst'

interface QuestCardProps {
  quest: Quest
  completion?: Completion
  weeklyCount?: number
  isExclusiveLocked?: boolean
  kidColor: KidColor
  onComplete?: () => Promise<void>
  isParent?: boolean
  onApprove?: (completionId: string) => Promise<void>
  onReject?: (completionId: string) => Promise<void>
}

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

function frequencyLabel(quest: Quest): string | null {
  if (quest.frequency === 'once') return 'one-time'
  if (quest.exclusive) return '1st claim wins'
  if (quest.weekly_target != null) return `${quest.weekly_target}× per week`
  if (quest.active_days && quest.active_days.length > 0 && quest.active_days.length < 7) {
    const abbreviated = quest.active_days.map(d => DAY_LABELS[d]).join(' ')
    return abbreviated
  }
  if (quest.frequency === 'weekly') return 'weekly'
  return null // daily — obvious, no label needed
}

export function QuestCard({
  quest,
  completion,
  weeklyCount = 0,
  isExclusiveLocked = false,
  kidColor,
  onComplete,
  isParent,
  onApprove,
  onReject,
}: QuestCardProps) {
  const [loading, setLoading] = useState(false)
  const [bursting, setBursting] = useState(false)
  const colors = KID_COLORS[kidColor]

  const isWeeklyFull = quest.weekly_target != null && weeklyCount >= quest.weekly_target
  const status = completion?.status
  const isTodo = !isExclusiveLocked && !isWeeklyFull && !status
  const isPending = status === 'pending' && !isWeeklyFull
  const isApproved = status === 'approved' || isWeeklyFull
  const isRejected = status === 'rejected' && !isWeeklyFull

  const tier = TIER_CONFIG[quest.tier ?? 'normal']
  const isNormal = (quest.tier ?? 'normal') === 'normal'
  const hasCompletionState = isApproved || isPending || isRejected || isExclusiveLocked

  const cardBg = isApproved
    ? 'rgba(74, 222, 128, 0.06)'
    : isPending
    ? 'rgba(251, 191, 36, 0.06)'
    : isRejected
    ? 'rgba(239, 68, 68, 0.05)'
    : isExclusiveLocked
    ? 'rgba(255,255,255,0.02)'
    : tier.bg

  const cardBorder = isApproved
    ? 'rgba(74, 222, 128, 0.25)'
    : isPending
    ? 'rgba(251, 191, 36, 0.35)'
    : isRejected
    ? 'rgba(239, 68, 68, 0.2)'
    : isExclusiveLocked
    ? 'rgba(255,255,255,0.06)'
    : tier.border

  const cardShadow = isPending
    ? '0 0 20px rgba(251, 191, 36, 0.12)'
    : isApproved
    ? '0 0 16px rgba(74, 222, 128, 0.1)'
    : isExclusiveLocked
    ? 'none'
    : tier.glow ?? 'none'

  const freqLabel = frequencyLabel(quest)

  const handleComplete = async () => {
    if (!onComplete || loading || !isTodo) return
    setLoading(true)
    setBursting(true)
    await onComplete()
    setLoading(false)
    setTimeout(() => setBursting(false), 1000)
  }

  return (
    <motion.div
      className="relative rounded-2xl overflow-hidden"
      style={{
        background: cardBg,
        border: `1px solid ${cardBorder}`,
        boxShadow: cardShadow,
        backdropFilter: 'blur(10px)',
        opacity: isExclusiveLocked ? 0.45 : 1,
      }}
      whileHover={isTodo && onComplete ? { scale: 1.015 } : {}}
      whileTap={isTodo && onComplete ? { scale: 0.985 } : {}}
      layout
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
    >
      <CoinBurst coins={quest.coins} active={bursting} />

      {/* Tier accent bar — thin colored line at top */}
      {!isNormal && !hasCompletionState && (
        <div
          className="absolute top-0 left-0 right-0 h-px"
          style={{
            background: `linear-gradient(90deg, transparent 0%, ${tier.color} 40%, ${tier.color} 60%, transparent 100%)`,
            opacity: 0.8,
          }}
        />
      )}

      {/* Legendary shimmer sweep */}
      {quest.tier === 'legendary' && !hasCompletionState && (
        <motion.div
          className="absolute inset-0 pointer-events-none rounded-2xl overflow-hidden"
          initial={{ x: '-120%' }}
          animate={{ x: '220%' }}
          transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 5, ease: 'easeInOut' }}
        >
          <div
            className="absolute inset-y-0 w-1/3 -skew-x-12"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(251,191,36,0.1), transparent)' }}
          />
        </motion.div>
      )}

      {/* Epic shimmer — slower, purple */}
      {quest.tier === 'epic' && !hasCompletionState && (
        <motion.div
          className="absolute inset-0 pointer-events-none rounded-2xl overflow-hidden"
          initial={{ x: '-120%' }}
          animate={{ x: '220%' }}
          transition={{ duration: 3, repeat: Infinity, repeatDelay: 7, ease: 'easeInOut' }}
        >
          <div
            className="absolute inset-y-0 w-1/3 -skew-x-12"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(167,139,250,0.12), transparent)' }}
          />
        </motion.div>
      )}

      <div className="p-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl leading-none mt-0.5 flex-shrink-0">{quest.icon}</span>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p
                className={`font-semibold text-sm leading-snug ${
                  isApproved ? 'line-through opacity-40' : isExclusiveLocked ? 'text-white/35' : 'text-white/90'
                }`}
              >
                {quest.title}
              </p>
              {!isNormal && (
                <span
                  className="text-xs px-1.5 py-0.5 rounded-md font-bold flex-shrink-0"
                  style={{ background: `${tier.color}18`, color: tier.color, border: `1px solid ${tier.color}40` }}
                >
                  {tier.label}
                </span>
              )}
            </div>

            {quest.description && (
              <p className="text-white/40 text-xs mt-0.5 truncate">{quest.description}</p>
            )}

            {/* Frequency / schedule info */}
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {freqLabel && (
                <span className="text-xs px-1.5 py-0.5 rounded-md"
                  style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  {freqLabel}
                </span>
              )}

              {/* Day-of-week pills inline with freq label */}
              {quest.active_days && quest.active_days.length > 0 && quest.active_days.length < 7 && (
                <div className="flex gap-0.5">
                  {DAY_LABELS.map((label, i) => (
                    <span
                      key={i}
                      className="text-xs w-4 h-4 flex items-center justify-center rounded font-mono"
                      style={{
                        background: quest.active_days!.includes(i) ? 'rgba(255,255,255,0.12)' : 'transparent',
                        color: quest.active_days!.includes(i) ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.18)',
                      }}
                    >
                      {label}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Weekly target progress */}
            {quest.weekly_target != null && (
              <p className="text-xs mt-1" style={{ color: isWeeklyFull ? '#4ade80' : 'rgba(255,255,255,0.4)' }}>
                {isWeeklyFull ? '✓ ' : ''}{weeklyCount}/{quest.weekly_target}× this week
              </p>
            )}
          </div>

          <div className="flex-shrink-0 text-right">
            <div className="flex items-center gap-1 justify-end">
              <span className="text-sm">🪙</span>
              <span className="font-heading font-bold text-sm" style={{ color: isNormal ? '#fbbf24' : tier.color }}>
                {quest.coins}
              </span>
            </div>
            {isPending && (
              <motion.p
                className="text-xs text-amber-400 mt-0.5"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.6, repeat: Infinity }}
              >
                awaiting...
              </motion.p>
            )}
            {isApproved && !isPending && (
              <p className="text-xs text-cq-forest mt-0.5">✓ done!</p>
            )}
            {isRejected && (
              <p className="text-xs text-red-400 mt-0.5">✗ retry</p>
            )}
            {isExclusiveLocked && (
              <p className="text-xs text-white/30 mt-0.5">claimed</p>
            )}
          </div>
        </div>

        {/* Complete button */}
        <AnimatePresence>
          {(isTodo || isRejected) && onComplete && (
            <motion.button
              onClick={handleComplete}
              disabled={loading}
              className="mt-3 w-full py-2.5 rounded-xl text-sm font-bold tracking-wide transition-all disabled:opacity-50"
              style={{
                background: `linear-gradient(135deg, ${colors.bg}, transparent)`,
                border: `1px solid ${colors.border}`,
                color: colors.primary,
              }}
              whileHover={{
                background: `linear-gradient(135deg, rgba(${
                  kidColor === 'azure' ? '56,189,248' : '167,139,250'
                }, 0.18), rgba(${
                  kidColor === 'azure' ? '56,189,248' : '167,139,250'
                }, 0.06))`,
              }}
              whileTap={{ scale: 0.97 }}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              {loading ? '✨ Sending quest...' : isRejected ? '🔄 Try Again' : '⚔️ Complete Quest'}
            </motion.button>
          )}
        </AnimatePresence>

        {/* Parent approval buttons */}
        {isParent && isPending && completion && (
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => onApprove?.(completion.id)}
              className="flex-1 py-2 rounded-xl text-xs font-bold transition-all"
              style={{
                background: 'rgba(74, 222, 128, 0.12)',
                border: '1px solid rgba(74, 222, 128, 0.28)',
                color: '#4ade80',
              }}
            >
              ✓ Approve
            </button>
            <button
              onClick={() => onReject?.(completion.id)}
              className="flex-1 py-2 rounded-xl text-xs font-bold transition-all"
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.22)',
                color: '#f87171',
              }}
            >
              ✗ Reject
            </button>
          </div>
        )}
      </div>

      {/* Approved shimmer overlay */}
      {isApproved && (
        <div
          className="absolute inset-0 pointer-events-none rounded-2xl"
          style={{
            background: 'linear-gradient(135deg, transparent 0%, rgba(74,222,128,0.04) 100%)',
          }}
        />
      )}
    </motion.div>
  )
}
