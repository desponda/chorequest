'use client'

import { motion } from 'framer-motion'

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-widest text-white/30 mb-3">{title}</p>
      <div
        className="rounded-2xl p-4"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        {children}
      </div>
    </div>
  )
}

export function Empty({ icon, message }: { icon: string; message: string }) {
  return (
    <div className="text-center py-8 text-white/30">
      <p className="text-3xl mb-2">{icon}</p>
      <p className="text-sm">{message}</p>
    </div>
  )
}

export function FormInput({
  placeholder, value, onChange, className = '',
}: {
  placeholder: string
  value: string
  onChange: (v: string) => void
  className?: string
}) {
  return (
    <input
      type="text"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full px-3 py-2.5 rounded-xl text-sm text-white/90 placeholder:text-white/25 outline-none ${className}`}
      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
    />
  )
}

export function ActionButton({
  onClick, label, disabled = false, className = 'w-full',
}: {
  onClick: () => void
  label: string
  disabled?: boolean
  className?: string
}) {
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      className={`${className} py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-40`}
      style={{
        background: 'rgba(251, 191, 36, 0.15)',
        border: '1px solid rgba(251, 191, 36, 0.35)',
        color: '#fbbf24',
      }}
      whileHover={{ background: 'rgba(251, 191, 36, 0.22)' }}
      whileTap={{ scale: 0.98 }}
    >
      {label}
    </motion.button>
  )
}

export const fadeSlide = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: { duration: 0.2 },
}
