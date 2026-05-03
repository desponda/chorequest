'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Quest, Completion, KidColor } from '@/lib/types'
import { KID_COLORS, TIER_CONFIG } from '@/lib/constants'
import { CoinBurst } from './coin-burst'

interface QuestCardProps {
  quest: Quest
  completion?: Completion
  kidColor: KidColor
  onComplete?: () => Promise<void>
  isParent?: boolean
  onApprove?: (completionId: string) => Promise<void>
  onReject?: (completionId: string) => Promise<void>
}

export function QuestCard({
  quest,
  completion,
  kidColor,
  onComplete,
  isParent,
  onApprove,
  onReject,
}: QuestCardProps) {
  const [loading, setLoading] = useState(false)
  const [bursting, setBursting] = useState(false)
  const colors = KID_COLORS[kidColor]

  const status = completion?.status
  const isTodo = !status
  const isPending = status === 'pending'
  const isApproved = status === 'approved'
  const isRejected = status === 'rejected'

  const tier = TIER_CONFIG[quest.tier ?? 'normal']

  const cardBg = isApproved
    ? 'rgba(74, 222, 128, 0.06)'
    : isPending
    ? 'rgba(251, 191, 36, 0.06)'
    : isRejected
    ? 'rgba(239, 68, 68, 0.05)'
    : tier.bg

  const cardBorder = isApproved
    ? 'rgba(74, 222, 128, 0.25)'
    : isPending
    ? 'rgba(251, 191, 36, 0.35)'
    : isRejected
    ? 'rgba(239, 68, 68, 0.2)'
    : tier.border

  const cardShadow = isPending
    ? '0 0 20px rgba(251, 191, 36, 0.12)'
    : isApproved
    ? '0 0 16px rgba(74, 222, 128, 0.1)'
    : tier.glow ?? 'none'

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
      }}
      whileHover={isTodo && onComplete ? { scale: 1.015 } : {}}
      whileTap={isTodo && onComplete ? { scale: 0.985 } : {}}
      layout
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
    >
      <CoinBurst coins={quest.coins} active={bursting} />

      <div className="p-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl leading-none mt-0.5 flex-shrink-0">{quest.icon}</span>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p
                className={`font-semibold text-sm leading-snug ${
                  isApproved ? 'line-through opacity-40' : 'text-white/90'
                }`}
              >
                {quest.title}
              </p>
              {(quest.tier ?? 'normal') !== 'normal' && (
                <span
                  className="text-xs px-1.5 py-0.5 rounded-md font-semibold flex-shrink-0"
                  style={{ background: tier.bg, color: tier.color, border: `1px solid ${tier.border}` }}
                >
                  {tier.label}
                </span>
              )}
            </div>
            {quest.description && (
              <p className="text-white/40 text-xs mt-0.5 truncate">{quest.description}</p>
            )}
          </div>

          <div className="flex-shrink-0 text-right">
            <div className="flex items-center gap-1 justify-end">
              <span className="text-sm">🪙</span>
              <span className="font-heading font-bold text-cq-gold text-sm">{quest.coins}</span>
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
            {isApproved && (
              <p className="text-xs text-cq-forest mt-0.5">✓ done!</p>
            )}
            {isRejected && (
              <p className="text-xs text-red-400 mt-0.5">✗ retry</p>
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
