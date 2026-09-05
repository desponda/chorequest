'use client'

export const dynamic = 'force-dynamic'

import { use, useCallback, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { RealmEmblem } from '@/components/ui/realm-emblem'
import { CenteredLoader } from '@/components/skeletons'
import { KID_COLORS } from '@/lib/constants'
import type { KidColor } from '@/lib/types'

interface FamilyData {
  id: string
  name: string
  kids: { id: string; name: string; avatar: string; color: KidColor }[]
}

export default function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const router = useRouter()
  const [family, setFamily] = useState<FamilyData | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [supabase] = useState(createClient)

  const loadFamily = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    setNotFound(false)
    setFamily(null)
    const { data, error } = await supabase.rpc('get_family_by_invite_token', { token })
    if (error) {
      setLoadError(true)
    } else if (data) {
      setFamily(data as FamilyData)
    } else {
      setNotFound(true)
    }
    setLoading(false)
  }, [token, supabase])

  useEffect(() => {
    loadFamily()
  }, [loadFamily])

  if (loading) {
    return <CenteredLoader />
  }

  if (loadError) {
    return (
      <div className="min-h-screen cq-page-shell flex items-center justify-center px-4 text-center safe-top safe-bottom">
        <div className="relative z-10 max-w-sm">
          <p className="text-cq-azure mb-4" aria-hidden="true"><RealmEmblem name="spark" size={48} /></p>
          <h1 className="font-heading text-2xl font-bold text-white mb-2">The portal flickered</h1>
          <p className="text-white/60 text-sm mb-6">We couldn&apos;t open this invite right now. Check your connection and try again.</p>
          <button
            type="button"
            onClick={loadFamily}
            className="min-h-11 px-6 rounded-xl text-sm font-bold text-cq-gold"
            style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.3)' }}
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  if (notFound || !family) {
    return (
      <div className="min-h-screen cq-page-shell flex items-center justify-center px-4">
        <div className="relative z-10 text-center">
          <p className="text-cq-mystic mb-4"><RealmEmblem name="dungeon" size={48} /></p>
          <h1 className="font-heading text-2xl font-bold text-white mb-2">Realm Not Found</h1>
          <p className="text-white/40 text-sm mb-6">This invite link may have expired or been reset.</p>
          <Link href="/" className="min-h-11 inline-flex items-center rounded-xl px-3 text-white/60 hover:text-white/90 transition-all text-sm">
            ← Back to Realm
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen cq-page-shell flex flex-col items-center justify-start sm:justify-center px-4 py-6 overflow-y-auto safe-top safe-bottom">
      <motion.div
        className="relative z-10 w-full max-w-xs"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="text-center mb-8">
          <motion.div
            className="inline-flex items-center justify-center text-cq-gold cq-hero-emblem mb-3"
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          >
            <RealmEmblem name="crest" size={54} />
          </motion.div>
          <h1 className="font-heading text-3xl font-bold text-white">{family.name}</h1>
          <p className="text-white/40 text-sm mt-1">Who are you?</p>
        </div>

        <div className="flex flex-col gap-3">
          {family.kids.length === 0 ? (
            <p className="text-center text-white/30 text-sm py-8">No adventurers in this realm yet.</p>
          ) : (
            family.kids.map((kid, i) => {
              const colors = KID_COLORS[kid.color]
              return (
                <motion.button
                  key={kid.id}
                  onClick={() => router.push(`/kid/${kid.id}`)}
                  className="flex items-center gap-4 p-4 rounded-2xl w-full text-left transition-all"
                  style={{ background: colors.bg, border: `1px solid ${colors.border}` }}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.07 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <span className="inline-flex h-10 w-10 items-center justify-center" style={{ color: colors.primary }}><RealmEmblem name="family" size={27} /></span>
                  <span className="font-heading font-bold text-lg" style={{ color: colors.primary }}>
                    {kid.name}
                  </span>
                  <span className="ml-auto text-white/30 text-sm">→</span>
                </motion.button>
              )
            })
          )}
        </div>

        <Link
          href="/"
          className="mt-8 min-h-11 flex items-center justify-center rounded-xl px-3 text-center text-white/60 text-sm hover:text-white/90 transition-all"
        >
          ← Back to Realm
        </Link>
      </motion.div>
    </div>
  )
}
