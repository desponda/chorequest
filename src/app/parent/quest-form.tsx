'use client'

import { useId } from 'react'
import type { Kid, Plan, QuestKind, QuestTier } from '@/lib/types'
import { QUEST_ICONS, TIER_CONFIG } from '@/lib/constants'
import { PLAN_LIMITS } from '@/lib/plans'
import { RealmIcon } from '@/components/ui/realm-icon'

const DAY_LABELS = ['Su','Mo','Tu','We','Th','Fr','Sa']
const TIERS: QuestTier[] = ['normal', 'rare', 'epic', 'legendary']

const KIND_LABELS: Record<QuestKind, { title: string; subtitle: string; emoji: string }> = {
  personal: {
    title: 'Personal Quest',
    subtitle: 'each assigned kid completes it',
    emoji: '⚔️',
  },
  shared: {
    title: 'Shared Bounty',
    subtitle: 'first kids to claim earn the coins',
    emoji: '⚡',
  },
  oneoff: {
    title: 'One-Time Task',
    subtitle: 'first kid claims, archived after approval',
    emoji: '⭐',
  },
}

export interface QuestFormState {
  title: string
  description: string
  icon: string
  coins: number
  forKid: string
  kind: QuestKind
  frequency: 'daily' | 'weekly' | 'once'
  tier: QuestTier
  slots: number
  activeDays: number[]
}

interface Props {
  state: QuestFormState
  onChange: (next: Partial<QuestFormState>) => void
  kids: Kid[]
  /** Edit mode shows all icons; create mode shows the first 14. */
  iconLimit?: number
  inputBg?: string
  /** Omit to allow all features (edit mode in QuestRow doesn't need plan gating). */
  plan?: Plan
}

export const initialQuestFormState: QuestFormState = {
  title: '',
  description: '',
  icon: '⚔️',
  coins: 10,
  forKid: 'all',
  kind: 'personal',
  frequency: 'daily',
  tier: 'normal',
  slots: 1,
  activeDays: [],
}

/** Returns a sane (kind, frequency) pair: personal/shared can be daily or weekly; oneoff is always once. */
export function normalizeKindFrequency(kind: QuestKind, frequency: QuestFormState['frequency']): QuestFormState['frequency'] {
  if (kind === 'oneoff') return 'once'
  if (frequency === 'once') return 'daily'
  return frequency
}

export function QuestFormFields({ state, onChange, kids, iconLimit, inputBg, plan }: Props) {
  const fieldId = useId()
  const icons = iconLimit ? QUEST_ICONS.slice(0, iconLimit) : QUEST_ICONS
  const inputStyle = inputBg ?? 'rgba(255,255,255,0.06)'
  const inputBorder = '1px solid rgba(255,255,255,0.1)'
  const limits = plan ? PLAN_LIMITS[plan] : PLAN_LIMITS['legendary']

  const setKind = (kind: QuestKind) => {
    onChange({
      kind,
      frequency: normalizeKindFrequency(kind, state.frequency),
      // shared keeps any existing slots; switching to personal/oneoff resets to 1
      slots: kind === 'shared' ? Math.max(1, state.slots) : 1,
    })
  }

  return (
    <>
      <fieldset>
        <legend className="field-label">Quest icon</legend>
        <div className="flex flex-wrap gap-1.5">
        {icons.map((ic) => (
          <button
            type="button"
            key={ic}
            onClick={() => onChange({ icon: ic })}
            aria-label={`Use ${ic} as the quest icon`}
            aria-pressed={state.icon === ic}
            className="w-11 h-11 rounded-xl transition-all inline-flex items-center justify-center"
            style={{
              background: state.icon === ic ? 'rgba(251,191,36,0.2)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${state.icon === ic ? 'rgba(251,191,36,0.4)' : 'rgba(255,255,255,0.08)'}`,
            }}
          >
            <RealmIcon name={ic} size={19} />
          </button>
        ))}
        </div>
      </fieldset>

      <label htmlFor={`${fieldId}-title`} className="block">
        <span className="field-label">Quest title</span>
        <input
          id={`${fieldId}-title`}
          value={state.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="e.g. Load the dishwasher"
          className="w-full min-h-11 px-3 py-2.5 rounded-xl text-sm text-white/90 placeholder:text-white/25 outline-none"
          style={{ background: inputStyle, border: inputBorder }}
        />
      </label>
      <label htmlFor={`${fieldId}-description`} className="block">
        <span className="field-label">Description <span className="font-normal">(optional)</span></span>
        <input
          id={`${fieldId}-description`}
          value={state.description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="Add helpful details"
          className="w-full min-h-11 px-3 py-2.5 rounded-xl text-sm text-white/90 placeholder:text-white/25 outline-none"
          style={{ background: inputStyle, border: inputBorder }}
        />
      </label>

      <div className="flex gap-2">
        <div className="flex-1">
          <label htmlFor={`${fieldId}-coins`} className="field-label">Coins</label>
          <input
            id={`${fieldId}-coins`}
            type="number"
            min={1}
            max={100}
            value={state.coins}
            onChange={(e) => onChange({ coins: Number(e.target.value) })}
            className="w-full min-h-11 px-3 py-2.5 rounded-xl text-sm text-white/90 outline-none"
            style={{ background: inputStyle, border: inputBorder }}
          />
        </div>
        <div className="flex-1">
          <label htmlFor={`${fieldId}-kid`} className="field-label">For</label>
          <select
            id={`${fieldId}-kid`}
            value={state.forKid}
            onChange={(e) => onChange({ forKid: e.target.value })}
            className="w-full min-h-11 px-3 py-2.5 rounded-xl text-sm text-white/90 outline-none"
            style={{ background: 'rgba(12,8,32,0.95)', border: inputBorder }}
          >
            <option value="all">All kids</option>
            {kids.map((k) => (
              <option key={k.id} value={k.id}>{k.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="text-xs text-white/40 mb-1.5 block">Type</label>
        <div className="grid grid-cols-3 gap-2">
          {(['personal', 'shared', 'oneoff'] as const).map((k) => {
            const meta = KIND_LABELS[k]
            const selected = state.kind === k
            return (
              <button
                type="button"
                key={k}
                onClick={() => setKind(k)}
                aria-pressed={selected}
                className="min-h-11 py-3 rounded-xl text-xs font-bold transition-all flex flex-col items-center gap-1"
                style={{
                  background: selected ? 'rgba(251,191,36,0.14)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${selected ? 'rgba(251,191,36,0.35)' : 'rgba(255,255,255,0.08)'}`,
                  color: selected ? '#fbbf24' : 'rgba(255,255,255,0.5)',
                }}
              >
                <RealmIcon name={meta.emoji} size={18} />
                <span>{meta.title}</span>
              </button>
            )
          })}
        </div>
        <p className="text-white/30 text-xs mt-1.5 text-center">{KIND_LABELS[state.kind].subtitle}</p>
      </div>

      {state.kind !== 'oneoff' && (
        <div>
          <label className="text-xs text-white/40 mb-1.5 block">Cadence</label>
          <div className="flex gap-2">
            {(['daily', 'weekly'] as const).map((f) => (
              <button
                type="button"
                key={f}
                onClick={() => onChange({ frequency: f })}
                aria-pressed={state.frequency === f}
                className="min-h-11 flex-1 py-2 rounded-xl text-sm font-semibold transition-all"
                style={{
                  background: state.frequency === f ? 'rgba(251,191,36,0.14)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${state.frequency === f ? 'rgba(251,191,36,0.35)' : 'rgba(255,255,255,0.08)'}`,
                  color: state.frequency === f ? '#fbbf24' : 'rgba(255,255,255,0.5)',
                }}
              >
                <span className="inline-flex items-center justify-center gap-1.5">{f === 'daily' ? <RealmIcon name="🔄" size={15} /> : <RealmIcon name="📅" size={15} />}{f === 'daily' ? 'Daily' : 'Weekly'}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {state.kind === 'shared' && (
        <div className="flex items-center gap-3">
          <label htmlFor={`${fieldId}-slots`} className="text-xs text-white/55 flex-shrink-0">Slots</label>
          <input
            id={`${fieldId}-slots`}
            type="number"
            min={1}
            max={20}
            value={state.slots}
            onChange={(e) => onChange({ slots: Math.max(1, Number(e.target.value)) })}
            className="w-20 min-h-11 px-3 py-2 rounded-xl text-sm text-white/90 outline-none"
            style={{ background: inputStyle, border: inputBorder }}
          />
          <span className="text-xs text-white/25">
            kids can claim per {state.frequency === 'weekly' ? 'week' : 'day'}
          </span>
        </div>
      )}

      {state.kind === 'personal' && state.frequency === 'daily' && (
        <div>
          <label className="text-xs text-white/40 mb-1.5 flex items-center gap-2">
            Active Days <span className="text-white/20 font-normal">(none = every day)</span>
            {!limits.activeDays && (
              <span className="text-white/25 text-xs">🔒 Legendary plan</span>
            )}
          </label>
          <div className={`flex gap-1 ${!limits.activeDays ? 'opacity-30 pointer-events-none' : ''}`}>
            {DAY_LABELS.map((day, i) => {
              const on = state.activeDays.includes(i)
              return (
                <button
                  type="button"
                  key={i}
                  onClick={() => onChange({
                    activeDays: on
                      ? state.activeDays.filter(d => d !== i)
                      : [...state.activeDays, i].sort((a, b) => a - b),
                  })}
                  aria-pressed={on}
                  aria-label={`${day}, ${on ? 'active' : 'inactive'}`}
                  className="min-h-11 flex-1 py-2 rounded-lg text-xs font-bold transition-all"
                  style={{
                    background: on ? 'rgba(56,189,248,0.18)' : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${on ? 'rgba(56,189,248,0.4)' : 'rgba(255,255,255,0.08)'}`,
                    color: on ? '#38bdf8' : 'rgba(255,255,255,0.35)',
                  }}
                >
                  {day}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div>
        <label className="text-xs text-white/40 mb-1.5 flex items-center gap-2">
          Tier
          {!limits.questTiers && (
            <span className="text-white/25 font-normal text-xs">🔒 Legendary plan</span>
          )}
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          {TIERS.map((t) => {
            const tc = TIER_CONFIG[t]
            const selected = state.tier === t
            const locked = t !== 'normal' && !limits.questTiers
            return (
              <button
                type="button"
                key={t}
                onClick={() => !locked && onChange({ tier: t })}
                disabled={locked}
                aria-pressed={selected}
                className="min-h-11 py-2 rounded-xl text-xs font-semibold transition-all"
                style={{
                  background: selected && !locked ? tc.bg : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${selected && !locked ? tc.border : 'rgba(255,255,255,0.08)'}`,
                  color: locked ? 'rgba(255,255,255,0.18)' : selected ? tc.color : 'rgba(255,255,255,0.4)',
                  boxShadow: selected && !locked && tc.glow ? tc.glow : 'none',
                  cursor: locked ? 'not-allowed' : 'pointer',
                }}
              >
                {locked ? '🔒 ' : ''}{tc.label}
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
}
