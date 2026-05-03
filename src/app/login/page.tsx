'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { StarField } from '@/components/star-field'
import { toast } from 'sonner'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: 'https://chorequest.dresponda.com/auth/callback?next=/parent' },
      })
      if (error) {
        toast.error(error.message)
      } else {
        toast.success('Realm created! Check your email to verify.')
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        toast.error('Wrong credentials — check your email and password')
      } else {
        router.push('/')
        router.refresh()
      }
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-quest-void flex items-center justify-center px-4">
      <StarField />

      <motion.div
        className="relative z-10 w-full max-w-sm"
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Title */}
        <div className="text-center mb-10">
          <motion.p
            className="text-5xl mb-4"
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          >
            🏰
          </motion.p>
          <h1 className="font-heading text-5xl font-black text-gradient-gold tracking-widest mb-2">
            ChoreQuest
          </h1>
          <p className="text-white/40 text-sm tracking-widest uppercase">
            The Family Realm
          </p>
        </div>

        {/* Card */}
        <div
          className="rounded-3xl p-8"
          style={{
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.09)',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 0 60px rgba(167, 139, 250, 0.08), 0 0 120px rgba(56, 189, 248, 0.05)',
          }}
        >
          {/* Mode toggle */}
          <div
            className="flex rounded-xl p-1 mb-8"
            style={{ background: 'rgba(255, 255, 255, 0.05)' }}
          >
            {(['login', 'signup'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className="flex-1 py-2 rounded-lg text-sm font-semibold capitalize transition-all"
                style={{
                  background: mode === m ? 'rgba(255, 255, 255, 0.09)' : 'transparent',
                  color: mode === m ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.38)',
                }}
              >
                {m === 'login' ? 'Enter Realm' : 'Create Realm'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-semibold text-white/50 uppercase tracking-widest mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="parent@family.com"
                required
                className="w-full px-4 py-3 rounded-xl text-sm text-white/90 placeholder:text-white/25 outline-none transition-all"
                style={{
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'rgba(251, 191, 36, 0.45)'
                  e.target.style.boxShadow = '0 0 0 3px rgba(251, 191, 36, 0.1)'
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)'
                  e.target.style.boxShadow = 'none'
                }}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-white/50 uppercase tracking-widest mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="w-full px-4 py-3 rounded-xl text-sm text-white/90 placeholder:text-white/25 outline-none transition-all"
                style={{
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'rgba(251, 191, 36, 0.45)'
                  e.target.style.boxShadow = '0 0 0 3px rgba(251, 191, 36, 0.1)'
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)'
                  e.target.style.boxShadow = 'none'
                }}
              />
            </div>

            <motion.button
              type="submit"
              disabled={loading}
              className="mt-2 w-full py-3.5 rounded-xl font-heading font-bold tracking-widest text-sm uppercase transition-all disabled:opacity-50"
              style={{
                background: 'linear-gradient(135deg, rgba(251,191,36,0.25), rgba(251,191,36,0.12))',
                border: '1px solid rgba(251, 191, 36, 0.4)',
                color: '#fbbf24',
                boxShadow: '0 0 20px rgba(251, 191, 36, 0.12)',
              }}
              whileHover={{ boxShadow: '0 0 30px rgba(251, 191, 36, 0.22)' }}
              whileTap={{ scale: 0.98 }}
            >
              <AnimatePresence mode="wait">
                {loading ? (
                  <motion.span
                    key="loading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    ✨ Casting spell...
                  </motion.span>
                ) : (
                  <motion.span
                    key="action"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    {mode === 'login' ? '⚔️ Enter the Realm' : '🏰 Create My Realm'}
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          </form>
        </div>

        <p className="text-center text-white/20 text-xs mt-6 tracking-widest uppercase">
          ✦ ChoreQuest · The Family Realm ✦
        </p>
      </motion.div>
    </div>
  )
}
