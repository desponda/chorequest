'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Kid, Quest, QuestKind, QuestTier } from '@/lib/types'
import { TIER_CONFIG } from '@/lib/constants'
import { QuestFormFields, type QuestFormState } from './quest-form'
import { AppIcon } from '@/components/app-icon'

interface Props {
  quest: Quest
  kids: Kid[]
  onToggle: (id: string, active: boolean) => void
  onDelete: (id: string) => void
  onSave: (id: string, updates: Partial<Quest>) => Promise<void>
}

const KIND_BADGE: Record<QuestKind, { label: string; color: string; bg: string; border: string } | null> = {
  personal: null,
  shared: { label: '⚡ Shared', color: '#fbbf24', bg: 'rgba(251,191,36,0.12)', border: 'rgba(251,191,36,0.25)' },
  oneoff: { label: '⭐ One-time', color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.2)' },
}

export function QuestRow({ quest, kids, onToggle, onDelete, onSave }: Props) {
  const [editing, setEditing] = useState(false)
  const [state, setState] = useState<QuestFormState>(() => ({
    title: quest.title,
    description: quest.description ?? '',
    icon: quest.icon,
    coins: quest.coins,
    forKid: quest.assigned_to ?? 'all',
    kind: quest.kind,
    frequency: quest.frequency,
    tier: (quest.tier ?? 'normal') as QuestTier,
    slots: quest.slots,
    activeDays: quest.active_days ?? [],
  }))

  const update = (patch: Partial<QuestFormState>) => setState((s) => ({ ...s, ...patch }))

  const assignedKid = kids.find((k) => k.id === quest.assigned_to)
  const tierCfg = TIER_CONFIG[quest.tier ?? 'normal']
  const kindBadge = KIND_BADGE[quest.kind]

  const handleSave = async () => {
    await onSave(quest.id, {
      title: state.title.trim(),
      description: state.description.trim() || null,
      icon: state.icon,
      coins: state.coins,
      assigned_to: state.forKid === 'all' ? null : state.forKid,
      kind: state.kind,
      frequency: state.frequency,
      tier: state.tier,
      slots: state.kind === 'shared' ? state.slots : 1,
      active_days: state.activeDays.length > 0 ? state.activeDays : null,
    })
    setEditing(false)
  }

  const cadenceLabel =
    quest.kind === 'oneoff' ? 'one-time' :
    quest.kind === 'shared' ? `${quest.frequency} · ${quest.slots} slot${quest.slots > 1 ? 's' : ''}` :
    quest.frequency

  return (
    <div
      className="rounded-xl mb-2 overflow-hidden"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      <div className="flex items-center gap-3 p-3">
        <AppIcon icon={quest.icon} size={20} color={TIER_CONFIG[quest.tier ?? 'normal'].color} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className={`text-sm font-semibold ${quest.active ? 'text-white/90' : 'text-white/40 line-through'}`}>
              {quest.title}
            </p>
            {(quest.tier ?? 'normal') !== 'normal' && (
              <span
                className="text-xs px-1.5 py-0.5 rounded-md flex-shrink-0"
                style={{ background: `${tierCfg.color}18`, color: tierCfg.color, border: `1px solid ${tierCfg.border}` }}
              >
                {tierCfg.label}
              </span>
            )}
            {kindBadge && (
              <span
                className="text-xs px-1.5 py-0.5 rounded-md flex-shrink-0"
                style={{ background: kindBadge.bg, color: kindBadge.color, border: `1px solid ${kindBadge.border}` }}
              >
                {kindBadge.label}
              </span>
            )}
          </div>
          <p className="text-white/35 text-xs">
            🪙 {quest.coins} · {assignedKid ? assignedKid.name : 'All kids'} · {cadenceLabel}
            {quest.active_days && quest.active_days.length > 0
              ? ` · ${quest.active_days.map(d => ['Su','Mo','Tu','We','Th','Fr','Sa'][d]).join(' ')}`
              : ''}
          </p>
        </div>
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
        <button
          onClick={() => onToggle(quest.id, quest.active)}
          className="text-xs px-2.5 py-1 rounded-lg transition-all"
          style={{
            background: quest.active ? 'rgba(74,222,128,0.1)' : 'rgba(255,255,255,0.05)',
            color: quest.active ? '#4ade80' : 'rgba(255,255,255,0.35)',
          }}
        >
          {quest.active ? 'On' : 'Off'}
        </button>
        <button
          onClick={() => onDelete(quest.id)}
          className="text-white/20 hover:text-red-400 transition-all text-xs ml-1"
        >
          ✕
        </button>
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
              className="px-3 pb-3 pt-1 flex flex-col gap-3"
              style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}
            >
              <QuestFormFields state={state} onChange={update} kids={kids} />
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  className="flex-1 py-2 rounded-xl text-sm font-bold transition-all"
                  style={{ background: 'rgba(74,222,128,0.14)', border: '1px solid rgba(74,222,128,0.3)', color: '#4ade80' }}
                >
                  Save Changes
                </button>
                <button
                  onClick={() => setEditing(false)}
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
