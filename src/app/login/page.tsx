'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { StarField } from '@/components/star-field'
import { toast } from 'sonner'

type Mode = 'login' | 'signup' | 'forgot'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<Mode>('login')
  const [loading, setLoading] = useState(false)
  const [forgotSent, setForgotSent] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const [showPassword, setShowPassword] = useState(false)
  const inputStyle = {
    background: 'rgba(255, 255, 255, 0.06)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
  }

  const handleAuthTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, current: 'login' | 'signup') => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const next = event.key === 'ArrowLeft' || event.key === 'Home' ? 'login' : 'signup'
    if (next === current && event.key !== 'Home' && event.key !== 'End') {
      const other = current === 'login' ? 'signup' : 'login'
      setMode(other)
      document.getElementById(`auth-tab-${other}`)?.focus()
      return
    }
    setMode(next)
    document.getElementById(`auth-tab-${next}`)?.focus()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/parent` },
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
        router.push('/display')
        router.refresh()
      }
    }

    setLoading(false)
  }

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    })
    setLoading(false)
    if (error) {
      toast.error(error.message)
    } else {
      setForgotSent(true)
    }
  }

  const handleResend = async () => {
    if (!email) {
      toast.error('Enter your email address first')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.resend({ type: 'signup', email })
    setLoading(false)
    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Confirmation email sent — check your inbox')
    }
  }

  return (
    <div className="min-h-screen bg-quest-void flex items-start sm:items-center justify-center px-4 py-6 sm:py-10 overflow-x-hidden overflow-y-auto safe-top safe-bottom">
      <StarField />

      <motion.div
        className="relative z-10 w-full max-w-sm"
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <Link
          href="/"
          className="inline-flex min-h-11 items-center rounded-xl px-2 text-sm font-semibold text-white/60 hover:text-white/90 transition-colors sm:fixed sm:top-5 sm:left-5 sm:z-20"
        >
          ← Back to ChoreQuest
        </Link>

        {/* Title */}
        <div className="text-center mb-6 sm:mb-8 mt-2">
          <motion.p
            className="text-4xl sm:text-5xl mb-2 sm:mb-3"
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          >
            🏰
          </motion.p>
          <h1 className="font-heading text-4xl sm:text-5xl font-black text-gradient-gold tracking-wide sm:tracking-widest mb-2">
            ChoreQuest
          </h1>
          <p className="text-white/40 text-sm tracking-widest uppercase">
            The Family Realm
          </p>
        </div>

        {/* Card */}
        <div
          className="rounded-3xl p-5 sm:p-8"
          style={{
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.09)',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 0 60px rgba(167, 139, 250, 0.08), 0 0 120px rgba(56, 189, 248, 0.05)',
          }}
        >
          <AnimatePresence mode="wait">
            {/* ── Forgot password ── */}
            {mode === 'forgot' ? (
              <motion.div
                key="forgot"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.2 }}
              >
                {forgotSent ? (
                  <div className="text-center py-4">
                    <p className="text-3xl mb-4">📬</p>
                    <h2 className="font-heading text-lg font-bold text-white/90 mb-2">Check your inbox</h2>
                    <p className="text-white/45 text-sm mb-6">
                      We sent a password reset link to <strong className="text-white/70">{email}</strong>
                    </p>
                    <button
                      onClick={() => { setMode('login'); setForgotSent(false) }}
                      className="min-h-11 px-3 rounded-xl text-sm text-white/60 hover:text-white/90 transition-colors"
                    >
                      ← Back to sign in
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleForgot} className="flex flex-col gap-4">
                    <div className="mb-2">
                      <h2 className="font-heading text-lg font-bold text-white/90 mb-1">Reset your password</h2>
                      <p className="text-white/40 text-sm">We&apos;ll email you a magic link to set a new one.</p>
                    </div>
                    <div>
                      <label htmlFor="forgot-email" className="block text-xs font-semibold text-white/60 uppercase tracking-widest mb-1.5">Email</label>
                      <input
                        id="forgot-email"
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="parent@family.com"
                        required
                        className="w-full px-4 py-3 rounded-xl text-base sm:text-sm text-white/90 placeholder:text-white/25 outline-none transition-all"
                        style={inputStyle}
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
                      }}
                      whileTap={{ scale: 0.98 }}
                    >
                      {loading ? '✨ Sending...' : '📬 Send reset link'}
                    </motion.button>
                    <button
                      type="button"
                      onClick={() => setMode('login')}
                      className="min-h-11 rounded-xl px-3 text-sm text-white/60 hover:text-white/90 transition-colors text-center"
                    >
                      ← Back to sign in
                    </button>
                  </form>
                )}
              </motion.div>
            ) : (
              /* ── Login / Signup ── */
              <motion.div
                key="auth"
                id="auth-panel"
                role="tabpanel"
                aria-labelledby={`auth-tab-${mode}`}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 16 }}
                transition={{ duration: 0.2 }}
              >
                {/* Mode toggle */}
                <div
                  className="flex rounded-xl p-1 mb-8"
                  style={{ background: 'rgba(255, 255, 255, 0.05)' }}
                  role="tablist"
                >
                  {(['login', 'signup'] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setMode(m)}
                      onKeyDown={(event) => handleAuthTabKeyDown(event, m)}
                      role="tab"
                      id={`auth-tab-${m}`}
                      aria-controls="auth-panel"
                      aria-selected={mode === m}
                      tabIndex={mode === m ? 0 : -1}
                      className="flex-1 min-h-[44px] py-2.5 rounded-lg text-sm font-semibold capitalize transition-all"
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
                    <label htmlFor="login-email" className="block text-xs font-semibold text-white/50 uppercase tracking-widest mb-1.5">Email</label>
                    <input
                      id="login-email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="parent@family.com"
                      required
                      className="w-full px-4 py-3 rounded-xl text-base sm:text-sm text-white/90 placeholder:text-white/25 outline-none transition-all"
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label htmlFor="login-password" className="block text-xs font-semibold text-white/50 uppercase tracking-widest">Password</label>
                      {mode === 'login' && (
                        <button
                          type="button"
                          onClick={() => setMode('forgot')}
                          className="min-h-11 px-2 rounded-lg text-xs text-white/60 hover:text-cq-gold transition-colors"
                        >
                          Forgot password?
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        id="login-password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        minLength={6}
                        className="w-full px-4 py-3 pr-12 rounded-xl text-base sm:text-sm text-white/90 placeholder:text-white/25 outline-none transition-all"
                        style={inputStyle}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((s) => !s)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        className="absolute right-0.5 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center rounded-xl text-white/55 hover:text-white/90 transition-colors"
                      >
                        {showPassword ? '🙈' : '👁️'}
                      </button>
                    </div>
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
                        <motion.span key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                          ✨ Casting spell...
                        </motion.span>
                      ) : (
                        <motion.span key="action" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                          {mode === 'login' ? '⚔️ Enter the Realm' : '🏰 Create My Realm'}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </motion.button>
                </form>

                {/* Resend confirmation — shown in login mode */}
                {mode === 'login' && (
                  <p className="mt-3 text-center text-xs text-white/50">
                    Didn&apos;t get a confirmation email?{' '}
                    <button
                      onClick={handleResend}
                      disabled={loading}
                      className="min-h-11 px-2 rounded-lg text-white/65 hover:text-cq-gold transition-colors underline underline-offset-2"
                    >
                      Resend it
                    </button>
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <p className="text-center text-white/50 text-xs mt-6 tracking-widest uppercase">
          ✦ ChoreQuest · The Family Realm ✦
        </p>
      </motion.div>
    </div>
  )
}
