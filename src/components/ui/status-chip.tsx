'use client'

import { motion } from 'framer-motion'

type StatusChipStatus = 'pending' | 'approved' | 'rejected' | 'locked'

const CHIP_CONFIG: Record<StatusChipStatus, {
  label: string
  bg: string
  border: string
  color: string
  pulse?: true
}> = {
  pending: {
    label: '⏳ awaiting',
    bg: 'rgba(251,191,36,0.15)',
    border: 'rgba(251,191,36,0.3)',
    color: '#fbbf24',
    pulse: true,
  },
  approved: {
    label: '✓ done',
    bg: 'rgba(74,222,128,0.12)',
    border: 'rgba(74,222,128,0.3)',
    color: '#4ade80',
  },
  rejected: {
    label: '✗ retry',
    bg: 'rgba(239,68,68,0.12)',
    border: 'rgba(239,68,68,0.3)',
    color: '#f87171',
  },
  locked: {
    label: 'claimed',
    bg: 'rgba(255,255,255,0.05)',
    border: 'rgba(255,255,255,0.1)',
    color: 'rgba(255,255,255,0.3)',
  },
}

const chipClass = 'text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap font-semibold'

export function StatusChip({ status }: { status: StatusChipStatus }) {
  const cfg = CHIP_CONFIG[status]
  const style = { background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color }

  if (cfg.pulse) {
    return (
      <motion.span
        className={chipClass}
        style={style}
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 1.6, repeat: Infinity }}
      >
        {cfg.label}
      </motion.span>
    )
  }

  return (
    <span className={chipClass} style={style}>
      {cfg.label}
    </span>
  )
}
