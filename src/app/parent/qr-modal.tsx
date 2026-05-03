'use client'

import { motion, AnimatePresence } from 'framer-motion'
import QRCode from 'react-qr-code'
import { toast } from 'sonner'
import type { Kid } from '@/lib/types'

interface Props {
  kid: Kid | null
  onClose: () => void
}

export function QrModal({ kid, onClose }: Props) {
  return (
    <AnimatePresence>
      {kid && (() => {
        const kidUrl = typeof window !== 'undefined'
          ? `${window.location.origin}/kid/${kid.id}`
          : `/kid/${kid.id}`
        return (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          >
            <motion.div
              className="relative w-full max-w-xs rounded-3xl p-6 text-center"
              style={{ background: '#0e0b24', border: '1px solid rgba(255,255,255,0.12)' }}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={onClose}
                className="absolute top-4 right-4 text-white/30 hover:text-white/70 transition-all text-lg"
              >
                ✕
              </button>
              <span className="text-4xl block mb-2">{kid.avatar}</span>
              <h3 className="font-heading font-bold text-white text-xl mb-4">{kid.name}</h3>
              <div className="bg-white p-4 rounded-2xl inline-block mb-4">
                <QRCode value={kidUrl} size={160} />
              </div>
              <p className="text-white/40 text-xs mb-4">Scan to go straight to {kid.name}&apos;s PIN screen</p>
              <div className="flex gap-2">
                <button
                  onClick={() => { navigator.clipboard.writeText(kidUrl); toast.success('Link copied!') }}
                  className="flex-1 py-2 rounded-xl text-sm font-semibold transition-all"
                  style={{ background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.25)', color: '#38bdf8' }}
                >
                  Copy Link
                </button>
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }}
                >
                  Print
                </button>
              </div>
            </motion.div>
          </motion.div>
        )
      })()}
    </AnimatePresence>
  )
}
