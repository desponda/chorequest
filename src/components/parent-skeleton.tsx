'use client'

import { motion } from 'framer-motion'
import { StarField } from './star-field'

/**
 * Skeleton shown while the parent dashboard data loads. Mirrors the real layout
 * (header, tab strip, content blocks) so the perceived load is shorter than a
 * full-screen "Loading" message.
 */
export function ParentSkeleton() {
  return (
    <div
      className="min-h-screen bg-quest-void flex flex-col"
      role="status"
      aria-live="polite"
      aria-label="Loading parent dashboard"
    >
      <StarField />
      <div className="relative z-10 flex flex-col flex-1 w-full max-w-2xl mx-auto">
        <header
          className="flex items-center gap-3 px-4 sm:px-6 py-3 sm:py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
        >
          <Shimmer className="h-5 w-16 rounded-md" />
          <div className="flex-1 flex justify-center">
            <Shimmer className="h-5 w-40 rounded-md" />
          </div>
          <Shimmer className="h-5 w-16 rounded-md" />
        </header>

        <div className="flex gap-1.5 px-4 sm:px-6 py-3 sm:py-4 flex-shrink-0">
          {Array.from({ length: 6 }).map((_, i) => (
            <Shimmer key={i} className="flex-1 h-12 rounded-xl" />
          ))}
        </div>

        <main className="flex-1 px-4 sm:px-6 pb-8 flex flex-col gap-4">
          <Shimmer className="h-5 w-24 rounded-md" />
          <Shimmer className="h-20 w-full rounded-2xl" />
          <Shimmer className="h-20 w-full rounded-2xl" />
          <Shimmer className="h-20 w-full rounded-2xl" />
        </main>
      </div>
    </div>
  )
}

function Shimmer({ className = '' }: { className?: string }) {
  return (
    <motion.div
      className={className}
      style={{
        background:
          'linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.09) 50%, rgba(255,255,255,0.04) 100%)',
        backgroundSize: '200% 100%',
      }}
      animate={{ backgroundPosition: ['200% 0', '-200% 0'] }}
      transition={{ duration: 1.4, repeat: Infinity, ease: 'linear' }}
    />
  )
}
