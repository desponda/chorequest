'use client'

import { useEffect } from 'react'

/**
 * Catches errors thrown in the root layout. Renders its own <html>/<body>
 * because the layout itself is broken at this point.
 */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string }
}) {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      console.error('Global error:', error)
    }
  }, [error])

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#050310',
          color: 'rgba(255,255,255,0.9)',
          fontFamily: 'ui-rounded, system-ui, sans-serif',
          textAlign: 'center',
          padding: '1rem',
        }}
      >
        <div style={{ maxWidth: 480 }}>
          <p style={{ fontSize: '4rem', marginBottom: '1rem' }}>⚠️</p>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.75rem', color: '#fbbf24' }}>
            The realm collapsed
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', marginBottom: '1.5rem' }}>
            ChoreQuest hit a critical error. Refreshing usually does the trick.
          </p>
          {error.digest && (
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.75rem', fontFamily: 'monospace', marginBottom: '1.5rem' }}>
              ref: {error.digest}
            </p>
          )}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- global-error renders outside the Next layout, so a hard reload is intentional. */}
          <a
            href="/"
            style={{
              display: 'inline-block',
              padding: '0.875rem 1.5rem',
              borderRadius: '1rem',
              background: 'rgba(251,191,36,0.18)',
              border: '1px solid rgba(251,191,36,0.4)',
              color: '#fbbf24',
              textDecoration: 'none',
              fontWeight: 700,
            }}
          >
            Reload ChoreQuest
          </a>
        </div>
      </body>
    </html>
  )
}
