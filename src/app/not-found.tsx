import Link from 'next/link'
import { StarField } from '@/components/star-field'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-quest-void flex items-center justify-center px-4 text-center">
      <StarField />
      <div className="relative z-10 max-w-md">
        <p className="text-6xl mb-6" aria-hidden="true">🗺️</p>
        <h1 className="font-heading text-4xl sm:text-5xl font-black text-gradient-gold tracking-widest mb-4">
          Off the Map
        </h1>
        <p className="text-white/45 text-base mb-8 leading-relaxed">
          The realm you&apos;re looking for isn&apos;t here. Maybe the link expired, or maybe the cartographers got it wrong.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center px-6 py-3 rounded-2xl font-bold text-sm transition-all"
            style={{
              background: 'rgba(251,191,36,0.18)',
              border: '1px solid rgba(251,191,36,0.4)',
              color: '#fbbf24',
            }}
          >
            ← Back to ChoreQuest
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center px-6 py-3 rounded-2xl font-bold text-sm transition-all text-white/60 hover:text-white/90 glass border-glass"
          >
            Sign in
          </Link>
        </div>
      </div>
    </div>
  )
}
