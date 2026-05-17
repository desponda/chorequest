'use client'

import { motion } from 'framer-motion'
import { StarField } from './star-field'

interface Props {
  label?: string
  size?: 'sm' | 'md' | 'lg'
}

export function LoadingScreen({ label = 'Loading', size = 'md' }: Props) {
  const textSize = size === 'lg' ? 'text-3xl' : size === 'sm' ? 'text-xl' : 'text-2xl'
  return (
    <div
      className="min-h-screen bg-quest-void flex items-center justify-center"
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <StarField />
      <motion.p
        className={`relative z-10 font-heading ${textSize} text-white/40`}
        animate={{ opacity: [0.3, 0.8, 0.3] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        ✦ {label} ✦
      </motion.p>
    </div>
  )
}
