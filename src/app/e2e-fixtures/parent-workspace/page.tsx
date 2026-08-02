'use client'

import { QuestsTab } from '@/app/parent/quests-tab'
import type { ParentActions } from '@/app/parent/use-parent-actions'
import { StarField } from '@/components/star-field'
import type { Kid, Quest } from '@/lib/types'

const kids: Kid[] = [
  {
    id: 'kid-aria',
    family_id: 'family-desktop',
    name: 'Aria',
    avatar: '🧙',
    color: 'azure',
    coins: 1540,
    streak: 8,
    last_completed_date: null,
    xp: 80,
    level: 1,
    created_at: new Date().toISOString(),
  },
  {
    id: 'kid-finn',
    family_id: 'family-desktop',
    name: 'Finn',
    avatar: '🦸',
    color: 'mystic',
    coins: 920,
    streak: 4,
    last_completed_date: null,
    xp: 160,
    level: 2,
    created_at: new Date().toISOString(),
  },
]

const quests: Quest[] = [
  {
    id: 'quest-bedroom',
    family_id: 'family-desktop',
    title: 'Tidy the bedroom before school',
    description: 'Put clothes away and make the bed.',
    icon: '🛏️',
    coins: 20,
    assigned_to: 'kid-aria',
    kind: 'personal',
    frequency: 'daily',
    tier: 'normal',
    slots: 1,
    active: true,
    archived: false,
    active_days: null,
    created_at: new Date().toISOString(),
  },
  {
    id: 'quest-dishwasher',
    family_id: 'family-desktop',
    title: 'Help unload the dishwasher',
    description: null,
    icon: '🍽️',
    coins: 30,
    assigned_to: null,
    kind: 'shared',
    frequency: 'daily',
    tier: 'epic',
    slots: 3,
    active: true,
    archived: false,
    active_days: null,
    created_at: new Date().toISOString(),
  },
]

const noop = async () => undefined
const actions = {
  addQuest: noop,
  seedDefaultQuests: noop,
  toggleQuest: noop,
  deleteQuest: noop,
  saveQuest: noop,
} as unknown as ParentActions

const tabs = [
  ['✓', 'Approvals'],
  ['⚔️', 'Quests'],
  ['🎁', 'Rewards'],
  ['☠️', 'Curses'],
  ['🏰', 'Dungeons'],
  ['👨‍👩‍👧', 'Family'],
]

export default function ParentWorkspaceFixture() {
  return (
    <div className="min-h-screen bg-quest-void flex flex-col">
      <StarField />
      <div className="workspace-frame workspace-frame-parent relative z-10 flex flex-col flex-1">
        <header className="workspace-header safe-top grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 px-4 sm:px-6 pb-3 sm:pb-4 border-b border-white/10 sm:border-b-0">
          <span className="justify-self-start text-sm text-white/60">← Realm</span>
          <h1 className="font-heading text-lg font-bold text-white/90">Parent Command</h1>
          <span className="justify-self-end text-sm text-white/60">Sign out</span>
        </header>

        <div className="workspace-tabs grid grid-cols-3 sm:grid-cols-6 gap-2 mx-4 sm:mx-6 my-3 sm:my-0 sm:mb-4" role="tablist" aria-label="Parent dashboard sections">
          {tabs.map(([icon, label]) => {
            const active = label === 'Quests'
            return (
              <button
                key={label}
                type="button"
                role="tab"
                aria-selected={active}
                tabIndex={active ? 0 : -1}
                className="min-h-12 rounded-xl px-2 text-sm font-semibold"
                style={{
                  color: active ? '#fbbf24' : 'rgba(255,255,255,0.68)',
                  background: active ? 'rgba(251,191,36,0.14)' : 'rgba(255,255,255,0.025)',
                  border: `1px solid ${active ? 'rgba(251,191,36,0.35)' : 'rgba(255,255,255,0.04)'}`,
                }}
              >
                <span aria-hidden="true">{icon}</span> {label}
              </button>
            )
          })}
        </div>

        <main className="workspace-main workspace-main-parent flex-1 px-4 sm:px-6 pb-8 safe-bottom">
          <QuestsTab kids={kids} quests={quests} actions={actions} plan="legendary" />
        </main>
      </div>
    </div>
  )
}
