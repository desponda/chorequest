'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Kid, Plan, Quest, QuestTier } from '@/lib/types'
import { QuestFormFields, type QuestFormState } from './quest-form'
import { TierBadge } from '@/components/ui/tier-badge'
import { KindBadge } from '@/components/ui/kind-badge'
import { ConfirmDelete } from '@/components/ui/confirm-delete'
import { RealmIcon } from '@/components/ui/realm-icon'

interface Props {
  quest: Quest
  kids: Kid[]
  plan: Plan
  onToggle: (id: string, active: boolean) => void
  onDelete: (id: string) => void
  onSave: (id: string, updates: Partial<Quest>) => Promise<void>
}

export function QuestRow({ quest, kids, plan, onToggle, onDelete, onSave }: Props) {
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
      <div className="flex flex-wrap items-start gap-3 p-3">
        <span className="text-cq-azure mt-0.5 flex-shrink-0 inline-flex items-center justify-center" aria-hidden="true"><RealmIcon name={quest.icon} size={22} /></span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className={`text-sm font-semibold ${quest.active ? 'text-white/90' : 'text-white/40 line-through'}`}>
              {quest.title}
            </p>
            <TierBadge tier={quest.tier} />
            <KindBadge kind={quest.kind} />
          </div>
          <p className="text-white/35 text-xs">
            <span className="inline-flex items-center gap-1"><RealmIcon name="🪙" size={13} />{quest.coins}</span> · {assignedKid ? assignedKid.name : 'All kids'} · {cadenceLabel}
            {quest.active_days && quest.active_days.length > 0
              ? ` · ${quest.active_days.map(d => ['Su','Mo','Tu','We','Th','Fr','Sa'][d]).join(' ')}`
              : ''}
          </p>
        </div>
        <div className="flex w-full sm:w-auto justify-end gap-1 flex-shrink-0 self-start">
          <button
            type="button"
            onClick={() => setEditing((e) => !e)}
            aria-label={editing ? `Close editor for ${quest.title}` : `Edit ${quest.title}`}
            aria-expanded={editing}
            className="min-h-11 min-w-11 inline-flex items-center justify-center text-xs rounded-xl transition-all"
            style={{
              background: editing ? 'rgba(251,191,36,0.12)' : 'rgba(255,255,255,0.05)',
              color: editing ? '#fbbf24' : 'rgba(255,255,255,0.4)',
            }}
          >
            ✏️
          </button>
          <button
            type="button"
            onClick={() => onToggle(quest.id, quest.active)}
            aria-label={quest.active ? `Disable ${quest.title}` : `Enable ${quest.title}`}
            aria-pressed={quest.active}
            className="min-h-11 min-w-11 px-3 text-xs rounded-xl transition-all"
            style={{
              background: quest.active ? 'rgba(74,222,128,0.1)' : 'rgba(255,255,255,0.05)',
              color: quest.active ? '#4ade80' : 'rgba(255,255,255,0.35)',
            }}
          >
            {quest.active ? 'On' : 'Off'}
          </button>
          <ConfirmDelete
            onConfirm={() => onDelete(quest.id)}
            ariaLabel={`Delete quest ${quest.title}`}
            confirmLabel="Delete quest"
            className="ml-0.5 px-1 py-1"
          />
        </div>
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
              <QuestFormFields state={state} onChange={update} kids={kids} plan={plan} />
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  className="min-h-11 flex-1 py-2 rounded-xl text-sm font-bold transition-all"
                  style={{ background: 'rgba(74,222,128,0.14)', border: '1px solid rgba(74,222,128,0.3)', color: '#4ade80' }}
                >
                  Save Changes
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="min-h-11 px-4 py-2 rounded-xl text-sm transition-all"
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
