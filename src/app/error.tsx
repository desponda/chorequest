'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { RealmEmblem } from '@/components/ui/realm-emblem'

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Sentry's `withSentryConfig` wraps the app, so errors bubble there.
    // Logging to console here helps local debugging without sending duplicate events.
    if (typeof window !== 'undefined') {
      console.error('Route error:', error)
    }
  }, [error])

  return (
    <div className="min-h-screen cq-page-shell flex items-center justify-center px-4 text-center">
      <div className="relative z-10 max-w-md">
        <p className="text-cq-gold mb-6" aria-hidden="true"><RealmEmblem name="shield" size={58} /></p>
        <h1 className="font-heading text-3xl sm:text-4xl font-black text-gradient-gold tracking-widest mb-3">
          The realm wavered
        </h1>
        <p className="text-white/45 text-sm sm:text-base mb-2 leading-relaxed">
          Something went sideways. The cartographers have been notified.
        </p>
        {error.digest && (
          <p className="text-white/25 text-xs font-mono mb-6">ref: {error.digest}</p>
        )}
        <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center min-h-[44px] px-6 py-3 rounded-2xl font-bold text-sm transition-all"
            style={{
              background: 'rgba(251,191,36,0.18)',
              border: '1px solid rgba(251,191,36,0.4)',
              color: '#fbbf24',
            }}
          >
            Try again
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center min-h-[44px] px-6 py-3 rounded-2xl font-bold text-sm transition-all text-white/60 hover:text-white/90 glass border-glass"
          >
            ← Back to ChoreQuest
          </Link>
        </div>
      </div>
    </div>
  )
}
