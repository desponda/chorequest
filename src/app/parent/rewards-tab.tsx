'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import type { Plan, Reward } from '@/lib/types'
import { PLAN_LABELS, PLAN_LIMITS } from '@/lib/plans'
import { ActionButton, Empty, FormInput, Section, fadeSlide } from './_ui'
import type { ParentActions } from './use-parent-actions'

interface Props {
  rewards: Reward[]
  actions: ParentActions
  plan: Plan
}

export function RewardsTab({ rewards, actions, plan }: Props) {
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [icon, setIcon] = useState('🎁')
  const [cost, setCost] = useState(50)
  const limits = PLAN_LIMITS[plan]
  const atLimit = limits.maxRewards < Infinity && rewards.length >= limits.maxRewards

  const handleAdd = async () => {
    if (!title.trim()) return
    await actions.addReward({ title, description: desc, icon, cost })
    setTitle('')
    setDesc('')
  }

  return (
    <motion.div key="rewards" {...fadeSlide} className="flex flex-col gap-6">
      <Section title="Add Reward">
        <div className="flex flex-col gap-3">
          <div className="flex gap-2 flex-wrap">
            {['🎁', '🎮', '📱', '🍕', '🎬', '🎡', '🎪', '🛒', '💤', '🎯', '🎨', '🎵'].map((ic) => (
              <button
                key={ic}
                onClick={() => setIcon(ic)}
                className="text-xl w-10 h-10 rounded-xl transition-all"
                style={{
                  background: icon === ic ? 'rgba(251,191,36,0.2)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${icon === ic ? 'rgba(251,191,36,0.4)' : 'rgba(255,255,255,0.08)'}`,
                }}
              >
                {ic}
              </button>
            ))}
          </div>
          <FormInput placeholder="Reward title..." value={title} onChange={setTitle} />
          <FormInput placeholder="Description (optional)" value={desc} onChange={setDesc} />
          <div>
            <label className="text-xs text-white/40 mb-1 block">Coin cost</label>
            <input
              type="number"
              min={1}
              value={cost}
              onChange={(e) => setCost(Number(e.target.value))}
              className="w-full px-3 py-2.5 rounded-xl text-sm text-white/90 outline-none"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
            />
          </div>
          {limits.maxRewards < Infinity && (
            <p className="text-xs text-center" style={{ color: atLimit ? '#fb923c' : 'rgba(255,255,255,0.3)' }}>
              {rewards.length} / {limits.maxRewards} rewards · {PLAN_LABELS[plan]} plan
            </p>
          )}
          <ActionButton onClick={handleAdd} label={atLimit ? 'Reward limit reached' : '+ Add Reward'} disabled={atLimit} />
        </div>
      </Section>

      <Section title="Reward Store">
        {rewards.length === 0 ? (
          <Empty icon="🎁" message="No rewards yet" />
        ) : (
          <div className="flex flex-col gap-2">
            {rewards.map((r) => (
              <div
                key={r.id}
                className="flex items-center gap-3 p-3 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <span className="text-2xl">{r.icon}</span>
                <div className="flex-1">
                  <p className="text-white/90 text-sm font-semibold">{r.title}</p>
                  {r.description && <p className="text-white/40 text-xs">{r.description}</p>}
                </div>
                <span className="text-cq-gold text-sm font-bold font-heading">🪙 {r.cost}</span>
                <button
                  onClick={() => actions.deleteReward(r.id)}
                  className="text-white/20 hover:text-red-400 transition-all text-xs ml-1"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </Section>
    </motion.div>
  )
}
