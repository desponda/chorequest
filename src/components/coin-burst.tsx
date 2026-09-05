'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { RealmIcon } from '@/components/ui/realm-icon'

interface Particle {
  id: number
  x: number
  y: number
  rotate: number
  delay: number
  scale: number
}

interface CoinBurstProps {
  coins: number
  active: boolean
}

function generateParticles(count: number): Particle[] {
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 - Math.PI / 2
    const spread = 60 + Math.random() * 50
    return {
      id: i,
      x: Math.cos(angle) * spread,
      y: Math.sin(angle) * spread - 20,
      rotate: Math.random() * 540 - 270,
      delay: Math.random() * 0.15,
      scale: 0.6 + Math.random() * 0.6,
    }
  })
}

export function CoinBurst({ coins, active }: CoinBurstProps) {
  const count = Math.min(Math.max(Math.floor(coins / 5) + 4, 5), 16)
  const [particles, setParticles] = useState<Particle[]>([])

  // Generate random particles in an effect so Math.random() is never called during render
  useEffect(() => {
    if (active) {
      setParticles(generateParticles(count))
    }
  }, [active, count])

  if (!active) return null

  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute text-cq-gold select-none"
          initial={{ x: 0, y: 0, opacity: 1, scale: p.scale, rotate: 0 }}
          animate={{
            x: p.x,
            y: p.y,
            opacity: 0,
            scale: p.scale * 0.4,
            rotate: p.rotate,
          }}
          transition={{ duration: 0.75, delay: p.delay, ease: [0.2, 0, 0.8, 1] }}
        >
          <RealmIcon name="🪙" size={20} strokeWidth={2.1} />
        </motion.div>
      ))}
      <motion.div
        className="absolute font-heading font-black text-cq-gold text-2xl"
        initial={{ y: 0, opacity: 1, scale: 0.6 }}
        animate={{ y: -55, opacity: 0, scale: 1.1 }}
        transition={{ duration: 0.9, ease: 'easeOut' }}
      >
        +{coins}
      </motion.div>
    </div>
  )
}
