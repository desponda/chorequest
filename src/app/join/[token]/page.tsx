'use client'

export const dynamic = 'force-dynamic'

import { use, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { AppIcon } from '@/components/app-icon'
import { createClient } from '@/lib/supabase/client'
import { StarField } from '@/components/star-field'
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
  const [supabase] = useState(createClient)

  useEffect(() => {
    supabase.rpc('get_family_by_invite_token', { token }).then(({ data }) => {
      if (data) {
        setFamily(data as FamilyData)
      } else {
        setNotFound(true)
      }
      setLoading(false)
    })
  }, [token, supabase])

  if (loading) {
    return (
      <div className="min-h-screen bg-quest-void flex items-center justify-center">
        <StarField />
        <motion.p
          className="relative z-10 font-heading text-2xl text-white/40"
          animate={{ opacity: [0.3, 0.8, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          ✦ Loading ✦
        </motion.p>
      </div>
    )
  }

  if (notFound || !family) {
    return (
      <div className="min-h-screen bg-quest-void flex items-center justify-center px-4">
        <StarField />
        <div className="relative z-10 text-center">
          <p className="text-5xl mb-4">🔮</p>
          <h1 className="font-heading text-2xl font-bold text-white mb-2">Realm Not Found</h1>
          <p className="text-white/40 text-sm mb-6">This invite link may have expired or been reset.</p>
          <Link href="/" className="text-white/40 hover:text-white/70 transition-all text-sm">
            ← Back to Realm
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-quest-void flex flex-col items-center justify-center px-4">
      <StarField />
      <motion.div
        className="relative z-10 w-full max-w-xs"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="text-center mb-8">
          <motion.p
            className="text-5xl mb-3"
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          >
            🏰
          </motion.p>
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
                  <AppIcon icon={kid.avatar} size={32} color={colors.primary} />
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
          className="mt-8 block text-center text-white/25 text-sm hover:text-white/50 transition-all"
        >
          ← Back to Realm
        </Link>
      </motion.div>
    </div>
  )
}
