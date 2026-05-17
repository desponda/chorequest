'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { StarField } from '@/components/star-field'
import { toast } from 'sonner'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const mismatch = confirm.length > 0 && password !== confirm
  const tooShort = password.length > 0 && password.length < 6

  const inputStyle = {
    background: 'rgba(255, 255, 255, 0.06)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirm) {
      toast.error('Passwords don\'t match')
      return
    }
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) {
      toast.error(error.message)
    } else {
      setDone(true)
      setTimeout(() => {
        router.push('/display')
        router.refresh()
      }, 2000)
    }
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
          <p className="text-white/40 text-sm tracking-widest uppercase">The Family Realm</p>
        </div>

        <div
          className="rounded-3xl p-8"
          style={{
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.09)',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 0 60px rgba(167, 139, 250, 0.08), 0 0 120px rgba(56, 189, 248, 0.05)',
          }}
        >
          {done ? (
            <div className="text-center py-4">
              <p className="text-3xl mb-4">✅</p>
              <h2 className="font-heading text-lg font-bold text-white/90 mb-2">Password updated!</h2>
              <p className="text-white/45 text-sm">Entering the realm...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="mb-2">
                <h2 className="font-heading text-lg font-bold text-white/90 mb-1">Set a new password</h2>
                <p className="text-white/40 text-sm">Choose something memorable, adventurer.</p>
              </div>

              <div>
                <label htmlFor="rp-password" className="block text-xs font-semibold text-white/50 uppercase tracking-widest mb-1.5">
                  New password
                </label>
                <div className="relative">
                  <input
                    id="rp-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    required
                    minLength={6}
                    aria-invalid={tooShort}
                    aria-describedby={tooShort ? 'rp-password-error' : undefined}
                    className="w-full px-4 py-3 pr-12 rounded-xl text-sm text-white/90 placeholder:text-white/25 outline-none transition-all"
                    style={inputStyle}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-lg text-white/35 hover:text-white/70 transition-colors"
                  >
                    {showPassword ? '🙈' : '👁️'}
                  </button>
                </div>
                {tooShort && (
                  <p id="rp-password-error" className="mt-1.5 text-xs text-red-400/80">
                    Must be at least 6 characters
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="rp-confirm" className="block text-xs font-semibold text-white/50 uppercase tracking-widest mb-1.5">
                  Confirm password
                </label>
                <input
                  id="rp-confirm"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Same as above"
                  required
                  aria-invalid={mismatch}
                  aria-describedby={mismatch ? 'rp-confirm-error' : undefined}
                  className="w-full px-4 py-3 rounded-xl text-sm text-white/90 placeholder:text-white/25 outline-none transition-all"
                  style={inputStyle}
                />
                {mismatch && (
                  <p id="rp-confirm-error" className="mt-1.5 text-xs text-red-400/80">
                    Passwords don&apos;t match yet
                  </p>
                )}
              </div>

              <motion.button
                type="submit"
                disabled={loading || mismatch || tooShort || password.length === 0}
                className="mt-2 w-full py-3.5 rounded-xl font-heading font-bold tracking-widest text-sm uppercase transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: 'linear-gradient(135deg, rgba(251,191,36,0.25), rgba(251,191,36,0.12))',
                  border: '1px solid rgba(251, 191, 36, 0.4)',
                  color: '#fbbf24',
                  boxShadow: '0 0 20px rgba(251, 191, 36, 0.12)',
                }}
                whileHover={{ boxShadow: '0 0 30px rgba(251, 191, 36, 0.22)' }}
                whileTap={{ scale: 0.98 }}
              >
                {loading ? '✨ Updating...' : '🔐 Set new password'}
              </motion.button>
            </form>
          )}
        </div>

        <p className="text-center text-white/20 text-xs mt-6 tracking-widest uppercase">
          ✦ ChoreQuest · The Family Realm ✦
        </p>
      </motion.div>
    </div>
  )
}
