'use client'

import { useEffect } from 'react'
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { CoinMark } from '@/components/ui/realm-emblem'

interface CoinCounterProps {
  value: number
  size?: 'sm' | 'md' | 'lg'
  showIcon?: boolean
}

const sizes = {
  sm: 'text-xl',
  md: 'text-3xl',
  lg: 'text-5xl',
}

export function CoinCounter({ value, size = 'md', showIcon = true }: CoinCounterProps) {
  const motionValue = useMotionValue(value)
  const spring = useSpring(motionValue, { stiffness: 80, damping: 18 })
  const display = useTransform(spring, (v) => Math.round(v).toLocaleString())

  useEffect(() => {
    motionValue.set(value)
  }, [value, motionValue])

  return (
    <div className="flex items-center gap-1.5">
      {showIcon && (
        <motion.span
          key={value}
          className="inline-flex items-center justify-center text-cq-gold"
          animate={{ scale: [1, 1.35, 1] }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
        >
          <CoinMark size={21} />
        </motion.span>
      )}
      <motion.span className={`font-heading font-bold text-cq-gold tabular-nums ${sizes[size]}`}>
        {display}
      </motion.span>
    </div>
  )
}
