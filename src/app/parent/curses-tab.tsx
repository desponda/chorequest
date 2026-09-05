'use client'

import { useId, useState } from 'react'
import { motion } from 'framer-motion'
import type { Kid, Plan, Curse, CurseInstance } from '@/lib/types'
import { PLAN_LIMITS } from '@/lib/plans'
import { Empty, FormInput, Section, fadeSlide } from './_ui'
import { ConfirmDelete } from '@/components/ui/confirm-delete'
import type { ParentActions } from './use-parent-actions'
import { RealmIcon } from '@/components/ui/realm-icon'

const CURSE_ICONS = ['☠️','😈','🌩️','🔥','💀','👿','🦂','🕸️']

interface Props {
  kids: Kid[]
  curses: Curse[]
  activeCurseInstances: CurseInstance[]
  actions: ParentActions
  plan: Plan
}

export function CursesTab({ kids, curses, activeCurseInstances, actions, plan }: Props) {
  const fieldId = useId()
  const [title, setTitle] = useState('')
  const [icon, setIcon] = useState('☠️')
  const [penalty, setPenalty] = useState(10)
  const [castingCurseId, setCastingCurseId] = useState<string | null>(null)

  // Quick cast state
  const [qcTitle, setQcTitle] = useState('')
  const [qcIcon, setQcIcon] = useState('😈')
  const [qcPenalty, setQcPenalty] = useState(10)

  if (!PLAN_LIMITS[plan].curses) {
    return (
      <motion.div key="curses" {...fadeSlide} className="flex flex-col gap-6">
        <div
          className="rounded-2xl p-10 text-center flex flex-col items-center gap-3"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <span className="h-14 w-14 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.62)' }}><RealmIcon name="🔒" size={29} /></span>
          <p className="font-heading text-white/60 font-bold text-lg">Coin adjustments · Family plan</p>
          <p className="text-white/35 text-sm max-w-xs">
            Create transparent coin adjustments when you need to correct the ledger. Available on Family and Legendary plans.
          </p>
        </div>
      </motion.div>
    )
  }

  const handleAdd = async () => {
    if (!title.trim()) return
    await actions.addCurse({ title, icon, penalty })
    setTitle('')
  }

  const handleCast = async (curseId: string, kidId: string) => {
    await actions.castCurse(curseId, kidId)
    setCastingCurseId(null)
  }

  const handleQuickCast = async (kidId: string) => {
    if (!qcTitle.trim()) return
    await actions.castAdHocCurse({ title: qcTitle, icon: qcIcon, penalty: qcPenalty, kidId })
    setQcTitle('')
    setQcPenalty(10)
  }

  return (
    <motion.div key="curses" {...fadeSlide} className="flex flex-col gap-6">
      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <Section title="Quick Cast">
        <div className="flex flex-col gap-3">
          <p className="text-white/40 text-xs">Make a one-off coin adjustment instantly — no template needed.</p>
          <div className="flex gap-2 flex-wrap">
            {CURSE_ICONS.map((ic) => (
              <button
                type="button"
                key={ic}
                onClick={() => setQcIcon(ic)}
                aria-label={`Use ${ic} as the quick curse icon`}
                aria-pressed={qcIcon === ic}
                className="w-11 h-11 rounded-xl transition-all inline-flex items-center justify-center"
                style={{
                  background: qcIcon === ic ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${qcIcon === ic ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.08)'}`,
                }}
              >
                <RealmIcon name={ic} size={19} />
              </button>
            ))}
          </div>
          <FormInput placeholder="What happened? (e.g. Whining, Hit sibling...)" value={qcTitle} onChange={setQcTitle} />
          <div>
            <label htmlFor={`${fieldId}-quick-penalty`} className="field-label">Coin penalty</label>
            <input
              id={`${fieldId}-quick-penalty`}
              type="number"
              min={1}
              max={200}
              value={qcPenalty}
              onChange={(e) => setQcPenalty(Number(e.target.value))}
              className="w-full min-h-11 px-3 py-2.5 rounded-xl text-sm text-white/90 outline-none"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
            />
          </div>
          {kids.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {kids.map(k => (
                <motion.button
                  key={k.id}
                  onClick={() => handleQuickCast(k.id)}
                  disabled={!qcTitle.trim()}
                  className="min-h-11 flex-1 px-3 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-30"
                  style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.35)', color: '#f87171' }}
                  whileHover={{ background: 'rgba(239,68,68,0.22)' }}
                  whileTap={{ scale: 0.97 }}
                >
                  <span className="inline-flex items-center justify-center gap-1.5"><RealmIcon name={k.avatar} size={15} /> Cast on {k.name}</span>
                </motion.button>
              ))}
            </div>
          )}
        </div>
        </Section>

        <Section title="Saved adjustments">
        <div className="flex flex-col gap-3">
          <p className="text-white/45 text-xs">
            Create named adjustments you can apply consistently when a correction is needed.
          </p>
          <div className="flex gap-2 flex-wrap">
            {CURSE_ICONS.map((ic) => (
              <button
                type="button"
                key={ic}
                onClick={() => setIcon(ic)}
                aria-label={`Use ${ic} as the saved curse icon`}
                aria-pressed={icon === ic}
                className="w-11 h-11 rounded-xl transition-all inline-flex items-center justify-center"
                style={{
                  background: icon === ic ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${icon === ic ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.08)'}`,
                }}
              >
                <RealmIcon name={ic} size={19} />
              </button>
            ))}
          </div>
          <FormInput placeholder="Curse name (e.g. Whining, Tantrum)..." value={title} onChange={setTitle} />
          <div>
            <label htmlFor={`${fieldId}-saved-penalty`} className="field-label">Coin penalty</label>
            <input
              id={`${fieldId}-saved-penalty`}
              type="number"
              min={1}
              max={200}
              value={penalty}
              onChange={(e) => setPenalty(Number(e.target.value))}
              className="w-full min-h-11 px-3 py-2.5 rounded-xl text-sm text-white/90 outline-none"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
            />
          </div>
          <motion.button
            onClick={handleAdd}
            disabled={!title.trim()}
            className="w-full min-h-11 px-4 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-40"
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
                  className="flex flex-wrap items-center gap-3 p-3 rounded-xl"
                  style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}
                >
                  <span className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171' }}><RealmIcon name={curse.icon} size={18} /></span>
                  <div className="flex-1">
                    <p className="text-white/85 text-sm font-semibold">{curse.title}</p>
                    <p className="text-red-400/60 text-xs">−{curse.penalty} coins</p>
                  </div>
                  {castingCurseId === curse.id ? (
                    <div className="flex w-full sm:w-auto gap-1 flex-wrap justify-end">
                      {kids.map(k => (
                        <button
                          key={k.id}
                          onClick={() => handleCast(curse.id, k.id)}
                          className="min-h-11 px-3 py-2 rounded-lg text-xs font-bold transition-all"
                          style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.35)', color: '#f87171' }}
                        >
                          <span className="inline-flex items-center gap-1.5"><RealmIcon name={k.avatar} size={14} /> {k.name}</span>
                        </button>
                      ))}
                      <button
                        onClick={() => setCastingCurseId(null)}
                        className="min-h-11 min-w-11 px-2 py-2 rounded-lg text-xs text-white/60 hover:text-white/90 transition-all"
                        aria-label="Cancel casting curse"
                      >
                        <RealmIcon name="✗" size={16} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCastingCurseId(curse.id)}
                        className="min-h-11 px-3 py-2 rounded-xl text-xs font-bold transition-all"
                        style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}
                      >
                        <span className="inline-flex items-center gap-1.5">Cast <RealmIcon name="⚡" size={14} /></span>
                      </button>
                      <ConfirmDelete
                        onConfirm={() => actions.deleteCurse(curse.id)}
                        ariaLabel={`Delete curse ${curse.title}`}
                        confirmLabel="Delete curse"
                        className="px-1 py-1"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        </Section>
      </div>

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
                  className="flex flex-wrap items-center gap-3 p-3 rounded-xl"
                  style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)' }}
                >
                  <span className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171' }}><RealmIcon name={curse?.icon ?? '☠️'} size={18} /></span>
                  <div className="flex-1 min-w-0">
                    <p className="text-white/85 text-sm font-semibold truncate">{curse?.title ?? 'Curse'}</p>
                    <p className="text-white/40 text-xs">
                      <span className="inline-flex items-center gap-1.5"><RealmIcon name={kid?.avatar ?? '🧙'} size={14} /> {kid?.name} · −{ci.coins_deducted} coins</span>
                    </p>
                  </div>
                  <div className="flex w-full sm:w-auto gap-1.5 flex-shrink-0 justify-end">
                    <button
                      onClick={() => actions.resolveCurse(ci.id, true)}
                      className="min-h-11 px-3 py-2 rounded-lg text-xs font-bold transition-all"
                      style={{ background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.25)', color: '#4ade80' }}
                      title="Lift curse and refund coins"
                    >
                      <span className="inline-flex items-center gap-1.5"><RealmIcon name="↩" size={14} /> Forgive</span>
                    </button>
                    <button
                      onClick={() => actions.resolveCurse(ci.id, false)}
                      className="min-h-11 px-3 py-2 rounded-lg text-xs font-bold transition-all"
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
