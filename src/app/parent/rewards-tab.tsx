'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Plan, Reward } from '@/lib/types'
import { PLAN_LABELS, PLAN_LIMITS } from '@/lib/plans'
import { ActionButton, Empty, FormInput, Section, fadeSlide } from './_ui'
import { ConfirmDelete } from '@/components/ui/confirm-delete'
import type { ParentActions } from './use-parent-actions'

const REWARD_ICONS = ['🎁', '🎮', '📱', '🍕', '🎬', '🎡', '🎪', '🛒', '💤', '🎯', '🎨', '🎵']

interface RewardRowProps {
  reward: Reward
  onSave: ParentActions['saveReward']
  onDelete: ParentActions['deleteReward']
}

function RewardRow({ reward, onSave, onDelete }: RewardRowProps) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(reward.title)
  const [desc, setDesc] = useState(reward.description ?? '')
  const [icon, setIcon] = useState(reward.icon)
  const [cost, setCost] = useState(reward.cost)

  const handleSave = async () => {
    await onSave(reward.id, { title, description: desc, icon, cost })
    setEditing(false)
  }

  const handleCancel = () => {
    setTitle(reward.title)
    setDesc(reward.description ?? '')
    setIcon(reward.icon)
    setCost(reward.cost)
    setEditing(false)
  }

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${editing ? 'rgba(251,191,36,0.2)' : 'rgba(255,255,255,0.08)'}` }}
    >
      <div className="flex items-center gap-3 p-3">
        <span className="text-2xl">{reward.icon}</span>
        <div className="flex-1">
          <p className="text-white/90 text-sm font-semibold">{reward.title}</p>
          {reward.description && <p className="text-white/40 text-xs">{reward.description}</p>}
        </div>
        <span className="text-cq-gold text-sm font-bold font-heading">🪙 {reward.cost}</span>
        <button
          onClick={() => setEditing((e) => !e)}
          className="text-xs px-2.5 py-1 rounded-lg transition-all"
          style={{
            background: editing ? 'rgba(251,191,36,0.12)' : 'rgba(255,255,255,0.05)',
            color: editing ? '#fbbf24' : 'rgba(255,255,255,0.4)',
          }}
        >
          ✏️
        </button>
        <ConfirmDelete
          onConfirm={() => onDelete(reward.id)}
          ariaLabel={`Delete reward ${reward.title}`}
          confirmLabel="Delete reward"
          className="ml-1 px-1 py-1"
        />
      </div>

      <AnimatePresence>
        {editing && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div
              className="px-3 pb-3 pt-2 flex flex-col gap-3"
              style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}
            >
              <div className="flex gap-2 flex-wrap">
                {REWARD_ICONS.map((ic) => (
                  <button
                    key={ic}
                    onClick={() => setIcon(ic)}
                    className="text-xl w-9 h-9 rounded-xl transition-all"
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
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  className="flex-1 py-2 rounded-xl text-sm font-bold transition-all"
                  style={{ background: 'rgba(74,222,128,0.14)', border: '1px solid rgba(74,222,128,0.3)', color: '#4ade80' }}
                >
                  Save Changes
                </button>
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 rounded-xl text-sm transition-all"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

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
              <RewardRow key={r.id} reward={r} onSave={actions.saveReward} onDelete={actions.deleteReward} />
            ))}
          </div>
        )}
      </Section>
    </motion.div>
  )
}
