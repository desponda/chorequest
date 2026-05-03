'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import type { Kid, Curse, CurseInstance } from '@/lib/types'
import { Empty, FormInput, Section, fadeSlide } from './_ui'
import type { ParentActions } from './use-parent-actions'

const CURSE_ICONS = ['☠️','😈','🌩️','🔥','💀','👿','🦂','🕸️']

interface Props {
  kids: Kid[]
  curses: Curse[]
  activeCurseInstances: CurseInstance[]
  actions: ParentActions
}

export function CursesTab({ kids, curses, activeCurseInstances, actions }: Props) {
  const [title, setTitle] = useState('')
  const [icon, setIcon] = useState('☠️')
  const [penalty, setPenalty] = useState(10)
  const [castingCurseId, setCastingCurseId] = useState<string | null>(null)

  const handleAdd = async () => {
    if (!title.trim()) return
    await actions.addCurse({ title, icon, penalty })
    setTitle('')
  }

  const handleCast = async (curseId: string, kidId: string) => {
    await actions.castCurse(curseId, kidId)
    setCastingCurseId(null)
  }

  return (
    <motion.div key="curses" {...fadeSlide} className="flex flex-col gap-6">
      <Section title="Define Curses">
        <div className="flex flex-col gap-3">
          <p className="text-white/45 text-xs">
            Create named penalties you can cast instantly when bad behavior happens.
          </p>
          <div className="flex gap-2 flex-wrap">
            {CURSE_ICONS.map((ic) => (
              <button
                key={ic}
                onClick={() => setIcon(ic)}
                className="text-xl w-10 h-10 rounded-xl transition-all"
                style={{
                  background: icon === ic ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${icon === ic ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.08)'}`,
                }}
              >
                {ic}
              </button>
            ))}
          </div>
          <FormInput placeholder="Curse name (e.g. Whining, Tantrum)..." value={title} onChange={setTitle} />
          <div>
            <label className="text-xs text-white/40 mb-1 block">Coin penalty</label>
            <input
              type="number"
              min={1}
              max={200}
              value={penalty}
              onChange={(e) => setPenalty(Number(e.target.value))}
              className="w-full px-3 py-2.5 rounded-xl text-sm text-white/90 outline-none"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
            />
          </div>
          <motion.button
            onClick={handleAdd}
            disabled={!title.trim()}
            className="w-full py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-40"
            style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.35)', color: '#f87171' }}
            whileHover={{ background: 'rgba(239,68,68,0.22)' }}
            whileTap={{ scale: 0.98 }}
          >
            + Add Curse
          </motion.button>

          {curses.length > 0 && (
            <div className="flex flex-col gap-2 mt-1">
              {curses.map(curse => (
                <div
                  key={curse.id}
                  className="flex items-center gap-3 p-3 rounded-xl"
                  style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}
                >
                  <span className="text-xl">{curse.icon}</span>
                  <div className="flex-1">
                    <p className="text-white/85 text-sm font-semibold">{curse.title}</p>
                    <p className="text-red-400/60 text-xs">−{curse.penalty} coins</p>
                  </div>
                  {castingCurseId === curse.id ? (
                    <div className="flex gap-1 flex-wrap">
                      {kids.map(k => (
                        <button
                          key={k.id}
                          onClick={() => handleCast(curse.id, k.id)}
                          className="px-2.5 py-1 rounded-lg text-xs font-bold transition-all"
                          style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.35)', color: '#f87171' }}
                        >
                          {k.avatar} {k.name}
                        </button>
                      ))}
                      <button
                        onClick={() => setCastingCurseId(null)}
                        className="px-2 py-1 rounded-lg text-xs text-white/30 hover:text-white/60 transition-all"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCastingCurseId(curse.id)}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
                        style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}
                      >
                        Cast ⚡
                      </button>
                      <button
                        onClick={() => actions.deleteCurse(curse.id)}
                        className="text-white/20 hover:text-red-400 transition-all text-xs"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </Section>

      <Section title="Active Afflictions">
        {activeCurseInstances.length === 0 ? (
          <Empty icon="✨" message="No active curses — all is well!" />
        ) : (
          <div className="flex flex-col gap-2">
            {activeCurseInstances.map(ci => {
              const curse = ci.curse as Curse | undefined
              const kid = ci.kid as Kid | undefined
              return (
                <div
                  key={ci.id}
                  className="flex items-center gap-3 p-3 rounded-xl"
                  style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)' }}
                >
                  <span className="text-xl">{curse?.icon ?? '☠️'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-white/85 text-sm font-semibold truncate">{curse?.title ?? 'Curse'}</p>
                    <p className="text-white/40 text-xs">
                      {kid?.avatar} {kid?.name} · −{ci.coins_deducted} coins
                    </p>
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => actions.resolveCurse(ci.id, true)}
                      className="px-2.5 py-1 rounded-lg text-xs font-bold transition-all"
                      style={{ background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.25)', color: '#4ade80' }}
                      title="Lift curse and refund coins"
                    >
                      ↩ Forgive
                    </button>
                    <button
                      onClick={() => actions.resolveCurse(ci.id, false)}
                      className="px-2.5 py-1 rounded-lg text-xs font-bold transition-all"
                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }}
                      title="Resolve without refund"
                    >
                      Resolve
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Section>
    </motion.div>
  )
}
