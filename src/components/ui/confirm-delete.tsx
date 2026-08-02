'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'

interface Props {
  onConfirm: () => void
  /** Label shown when collapsed. Defaults to ✕. */
  trigger?: React.ReactNode
  /** Confirm prompt shown in the expanded state. */
  prompt?: string
  /** Confirm button label. */
  confirmLabel?: string
  className?: string
  /** aria-label for the trigger button. */
  ariaLabel?: string
  /** Auto-collapse after this many ms if the user doesn't confirm. */
  timeoutMs?: number
}

/**
 * Two-tap inline destructive confirmation. First tap reveals "Sure?" — second tap commits.
 * Reverts after a few seconds of inactivity so a stray tap doesn't sit in a primed state.
 */
export function ConfirmDelete({
  onConfirm,
  trigger = '✕',
  prompt = 'Sure?',
  confirmLabel = 'Delete',
  className = '',
  ariaLabel = 'Delete',
  timeoutMs = 4000,
}: Props) {
  const [armed, setArmed] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!armed) return
    timerRef.current = setTimeout(() => setArmed(false), timeoutMs)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [armed, timeoutMs])

  if (!armed) {
    return (
      <button
        type="button"
        onClick={() => setArmed(true)}
        aria-label={ariaLabel}
        className={`min-h-11 min-w-11 inline-flex items-center justify-center rounded-lg text-white/50 hover:text-red-400 transition-all text-sm ${className}`}
      >
        {trigger}
      </button>
    )
  }

  return (
    <motion.div
      className="flex flex-wrap items-center justify-end gap-1.5"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.12 }}
    >
      <button
        type="button"
        onClick={() => {
          if (timerRef.current) clearTimeout(timerRef.current)
          setArmed(false)
          onConfirm()
        }}
        className="min-h-11 px-3 py-2 rounded-lg text-xs font-bold transition-all"
        style={{
          background: 'rgba(239,68,68,0.15)',
          border: '1px solid rgba(239,68,68,0.4)',
          color: '#f87171',
        }}
      >
        {prompt} {confirmLabel}
      </button>
      <button
        type="button"
        onClick={() => setArmed(false)}
        className="min-h-11 px-3 py-2 rounded-lg text-xs text-white/60 hover:text-white/90"
        aria-label="Cancel"
      >
        Cancel
      </button>
    </motion.div>
  )
}
