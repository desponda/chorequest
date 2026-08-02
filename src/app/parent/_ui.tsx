'use client'

import { motion } from 'framer-motion'
import { useId } from 'react'

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xs font-bold uppercase tracking-widest text-white/50 mb-3">{title}</h2>
      <div className="surface-panel rounded-2xl p-4">
        {children}
      </div>
    </section>
  )
}

export function Empty({
  icon,
  message,
  hint,
}: {
  icon: string
  message: string
  hint?: string
}) {
  return (
    <div className="text-center py-8 text-white/30">
      <p className="text-3xl mb-2" aria-hidden="true">{icon}</p>
      <p className="text-sm text-white/45">{message}</p>
      {hint && <p className="text-xs text-white/30 mt-1.5">{hint}</p>}
    </div>
  )
}

export function FormInput({
  placeholder, value, onChange, className = '', label,
}: {
  placeholder: string
  value: string
  onChange: (v: string) => void
  className?: string
  label?: string
}) {
  const id = useId()
  const visibleLabel = label ?? placeholder.replace(/\.{3}$/u, '')

  return (
    <label htmlFor={id} className="block">
      <span className="field-label">{visibleLabel}</span>
      <input
        id={id}
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`field-control w-full min-h-11 px-3 py-2.5 rounded-xl text-sm text-white/90 placeholder:text-white/25 outline-none ${className}`}
      />
    </label>
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
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${className} min-h-11 px-4 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-40`}
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
