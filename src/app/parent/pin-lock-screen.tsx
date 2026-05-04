'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { StarField } from '@/components/star-field'

interface Props {
  lockPinInput: string
  lockPinError: boolean
  parentLockedUntil: number | null
  now: number
  onDigit: (digit: string) => void | Promise<void>
  onBackspace: () => void
}

export function PinLockScreen({ lockPinInput, lockPinError, parentLockedUntil, now, onDigit, onBackspace }: Props) {
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
          🔒
        </motion.span>
        <h2 className="font-heading text-3xl font-bold text-white mb-1">Parent Command</h2>
        {parentLockedUntil && now < parentLockedUntil ? (
          <p className="text-red-400 text-sm mb-8">
            🔒 Too many attempts — try again in{' '}
            {Math.ceil((parentLockedUntil - now) / 1000)}s
          </p>
        ) : (
          <p className="text-white/40 text-sm mb-8">Enter your parent PIN</p>
        )}

        <div className="flex justify-center gap-4 mb-8">
          {Array.from({ length: 4 }, (_, i) => (
            <motion.div
              key={i}
              className="w-4 h-4 rounded-full border-2"
              style={{
                borderColor: lockPinError ? '#f87171' : 'rgba(251,191,36,0.5)',
                background: lockPinInput.length > i
                  ? (lockPinError ? '#f87171' : '#fbbf24')
                  : 'transparent',
              }}
              animate={lockPinError ? { x: [-4, 4, -4, 4, 0] } : {}}
              transition={{ duration: 0.3 }}
            />
          ))}
        </div>

        <div className="grid grid-cols-3 gap-3 max-w-[240px] mx-auto">
          {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((d) => (
            <motion.button
              key={d}
              onClick={() => {
                if (d === '⌫') onBackspace()
                else if (d && lockPinInput.length < 4) onDigit(d)
              }}
              disabled={!d}
              className="h-14 rounded-2xl font-heading font-bold text-xl transition-all disabled:opacity-0"
              style={{
                background: d ? 'rgba(255,255,255,0.06)' : 'transparent',
                border: d ? '1px solid rgba(255,255,255,0.09)' : 'none',
                color: d === '⌫' ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.85)',
              }}
              whileHover={d ? { background: 'rgba(251,191,36,0.12)' } : {}}
              whileTap={d ? { scale: 0.93 } : {}}
            >
              {d}
            </motion.button>
          ))}
        </div>

        <Link href="/display" className="block mt-8 text-white/25 text-sm hover:text-white/50 transition-all">
          ← Back to Realm
        </Link>
      </motion.div>
    </div>
  )
}
