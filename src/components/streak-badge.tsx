'use client'

import { motion } from 'framer-motion'
import { RealmIcon } from './ui/realm-icon'
interface StreakBadgeProps {
  streak: number
  compact?: boolean
}

export function StreakBadge({ streak, compact = false }: StreakBadgeProps) {
  if (streak < 2) return null

  if (compact) {
    return (
      <motion.div
        className="flex items-center gap-1"
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
      >
        <RealmIcon name="🔥" size={14} />
        <span className="text-cq-ember text-xs font-bold">{streak}</span>
      </motion.div>
    )
  }

  return (
    <motion.div
      className="flex items-center gap-2 px-3 py-1.5 rounded-full"
      style={{
        background: 'rgba(251, 146, 60, 0.12)',
        border: '1px solid rgba(251, 146, 60, 0.28)',
      }}
      animate={{ scale: [1, 1.02, 1] }}
      transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
    >
      <motion.span
        className="text-lg"
        animate={{ rotate: [0, 8, -8, 0] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
      >
        <RealmIcon name="🔥" size={18} />
      </motion.span>
      <span className="text-cq-ember font-bold text-sm">
        {streak} day streak
      </span>
    </motion.div>
  )
}
