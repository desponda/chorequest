'use client'

import { motion } from 'framer-motion'

function Shimmer({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <motion.div
      className={className}
      style={{
        background:
          'linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.09) 50%, rgba(255,255,255,0.04) 100%)',
        backgroundSize: '200% 100%',
        ...style,
      }}
      animate={{ backgroundPosition: ['200% 0', '-200% 0'] }}
      transition={{ duration: 1.4, repeat: Infinity, ease: 'linear' }}
    />
  )
}

/** Skeleton for the parent dashboard. Header + tabs + content blocks. */
export function ParentSkeleton() {
  return (
    <div
      className="min-h-screen cq-page-shell flex flex-col"
      role="status"
      aria-live="polite"
      aria-label="Loading parent dashboard"
    >
      <div className="workspace-frame workspace-frame-parent relative z-10 flex flex-col flex-1">
        <header className="workspace-header safe-top flex items-center gap-3 px-4 sm:px-6 pb-3 sm:pb-4 flex-shrink-0 border-b border-white/10 sm:border-b-0">
          <Shimmer className="h-5 w-16 rounded-md" />
          <div className="flex-1 flex justify-center">
            <Shimmer className="h-5 w-40 rounded-md" />
          </div>
          <Shimmer className="h-5 w-16 rounded-md" />
        </header>
        <div className="workspace-tabs grid grid-cols-3 sm:grid-cols-6 gap-2 mx-4 sm:mx-6 my-3 sm:my-0 sm:mb-4 flex-shrink-0">
          {Array.from({ length: 6 }).map((_, i) => (
            <Shimmer key={i} className="flex-1 h-12 rounded-xl" />
          ))}
        </div>
        <main className="workspace-main workspace-main-parent flex-1 px-4 sm:px-6 pb-8 flex flex-col gap-4 safe-bottom">
          <Shimmer className="h-5 w-24 rounded-md" />
          <Shimmer className="h-20 w-full rounded-2xl" />
          <Shimmer className="h-20 w-full rounded-2xl" />
          <Shimmer className="h-20 w-full rounded-2xl" />
        </main>
      </div>
    </div>
  )
}

/** Skeleton for the per-kid quest board view. Matches the real /kid/[id] layout. */
export function KidViewSkeleton() {
  return (
    <div
      className="min-h-screen cq-page-shell flex flex-col"
      role="status"
      aria-live="polite"
      aria-label="Loading quest board"
    >
      <div className="workspace-frame workspace-frame-kid relative z-10 flex flex-col flex-1">
        <header className="workspace-header safe-top flex items-center gap-3 px-4 sm:px-6 pb-4 sm:pb-5 flex-shrink-0">
          <Shimmer className="h-5 w-16 rounded-md" />
          <div className="flex-1 flex items-center gap-3 justify-center">
            <Shimmer className="h-10 w-10 rounded-full" />
            <div className="flex flex-col gap-1">
              <Shimmer className="h-5 w-20 rounded-md" />
              <Shimmer className="h-3 w-24 rounded-md" />
            </div>
          </div>
          <Shimmer className="h-7 w-14 rounded-xl" />
        </header>
        <div className="workspace-tabs flex mx-4 sm:mx-6 gap-1.5 sm:gap-2 mb-4 flex-shrink-0">
          {Array.from({ length: 4 }).map((_, i) => (
            <Shimmer key={i} className="flex-1 h-11 rounded-xl" />
          ))}
        </div>
        <main className="workspace-main workspace-main-kid flex-1 px-4 sm:px-6 pb-8 flex flex-col gap-3 safe-bottom">
          <Shimmer className="h-4 w-20 rounded-md" />
          {Array.from({ length: 4 }).map((_, i) => (
            <Shimmer key={i} className="h-14 w-full rounded-2xl" />
          ))}
        </main>
      </div>
    </div>
  )
}

/** Skeleton for the wall display. Two columns of kid quests + header. */
export function DisplaySkeleton() {
  return (
    <div
      className="min-h-screen cq-page-shell flex flex-col"
      role="status"
      aria-live="polite"
      aria-label="Loading the realm"
    >
      <header className="relative z-10 flex items-center justify-between px-4 sm:px-8 py-3 sm:py-5 flex-shrink-0">
        <div className="flex-1" />
        <Shimmer className="h-8 w-44 rounded-md" />
        <div className="flex-1 flex justify-end items-center gap-1.5 sm:gap-3">
          <Shimmer className="h-11 w-11 sm:w-24 rounded-xl" />
          <Shimmer className="h-11 w-11 sm:w-24 rounded-xl" />
        </div>
      </header>
      <main
        className="relative z-10 flex-1 grid gap-4 sm:gap-6 px-4 sm:px-8 pb-4 min-h-0"
        style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}
      >
        {Array.from({ length: 2 }).map((_, col) => (
          <div key={col} className="flex flex-col h-full gap-4 min-h-0">
            <Shimmer className="h-48 w-full rounded-3xl" />
            <div className="flex flex-col gap-2.5">
              {Array.from({ length: 4 }).map((_, i) => (
                <Shimmer key={i} className="h-14 w-full rounded-2xl" />
              ))}
            </div>
          </div>
        ))}
      </main>
    </div>
  )
}

/** Generic centered loader used for join + small surfaces. */
export function CenteredLoader({ label = 'Loading' }: { label?: string }) {
  return (
    <div
      className="min-h-screen cq-page-shell flex items-center justify-center"
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <motion.p
        className="relative z-10 font-heading text-2xl text-white/40"
        animate={{ opacity: [0.3, 0.8, 0.3] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        ✦ {label} ✦
      </motion.p>
    </div>
  )
}
