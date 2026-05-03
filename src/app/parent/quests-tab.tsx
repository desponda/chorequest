'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import type { Kid, Quest } from '@/lib/types'
import { ActionButton, Empty, Section, fadeSlide } from './_ui'
import { QuestFormFields, initialQuestFormState, type QuestFormState } from './quest-form'
import { QuestRow } from './quest-row'
import type { ParentActions } from './use-parent-actions'

interface Props {
  kids: Kid[]
  quests: Quest[]
  actions: ParentActions
}

export function QuestsTab({ kids, quests, actions }: Props) {
  const [state, setState] = useState<QuestFormState>(initialQuestFormState)

  const update = (patch: Partial<QuestFormState>) => setState((s) => ({ ...s, ...patch }))

  const handleAdd = async () => {
    if (!state.title.trim()) return
    await actions.addQuest({
      title: state.title,
      description: state.description,
      icon: state.icon,
      coins: state.coins,
      assignedTo: state.forKid === 'all' ? null : state.forKid,
      kind: state.kind,
      frequency: state.frequency,
      tier: state.tier,
      slots: state.slots,
      activeDays: state.activeDays,
    })
    setState((s) => ({
      ...s,
      title: '',
      description: '',
      kind: 'personal',
      frequency: 'daily',
      tier: 'normal',
      activeDays: [],
      slots: 1,
    }))
  }

  const active = quests.filter((q) => q.active)
  const archived = quests.filter((q) => !q.active)

  return (
    <motion.div key="quests" {...fadeSlide} className="flex flex-col gap-6">
      <Section title="Add New Quest">
        <div className="flex flex-col gap-3">
          <QuestFormFields state={state} onChange={update} kids={kids} iconLimit={14} />
          <ActionButton onClick={handleAdd} label="+ Add Quest" />
        </div>
      </Section>

      {quests.length === 0 && (
        <button
          onClick={actions.seedDefaultQuests}
          className="text-sm text-white/40 hover:text-white/70 transition-all text-center underline underline-offset-4"
        >
          Or add default starter quests →
        </button>
      )}

      <Section title="Active Quests">
        {active.length === 0 ? (
          <Empty icon="⚔️" message="No active quests" />
        ) : (
          active.map((q) => (
            <QuestRow
              key={q.id}
              quest={q}
              kids={kids}
              onToggle={actions.toggleQuest}
              onDelete={actions.deleteQuest}
              onSave={actions.saveQuest}
            />
          ))
        )}
      </Section>

      {archived.length > 0 && (
        <Section title="Archived Quests">
          {archived.map((q) => (
            <QuestRow
              key={q.id}
              quest={q}
              kids={kids}
              onToggle={actions.toggleQuest}
              onDelete={actions.deleteQuest}
              onSave={actions.saveQuest}
            />
          ))}
        </Section>
      )}
    </motion.div>
  )
}
