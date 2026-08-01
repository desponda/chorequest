'use client'

/**
 * E2E fixture — renders QuestCard in every alignment-relevant state.
 * No auth required. Not linked from the app.
 */

import { QuestCard } from '@/components/quest-card'
import type { Quest, Completion } from '@/lib/types'

const BASE_QUEST: Quest = {
  id: 'q1',
  family_id: 'f1',
  title: 'Test Quest',
  description: null,
  icon: '🧹',
  coins: 5,
  assigned_to: null,
  kind: 'personal',
  frequency: 'daily',
  tier: 'normal',
  slots: 1,
  active: true,
  archived: false,
  active_days: null,
  created_at: '2026-01-01T00:00:00Z',
}

const COMPLETION = (status: 'pending' | 'approved' | 'rejected'): Completion => ({
  id: 'c1',
  quest_id: 'q1',
  kid_id: 'k1',
  status,
  completed_at: '2026-01-01T00:00:00Z',
  approved_at: null,
  coins_awarded: null,
  date: '2026-01-01',
})

const CARDS: { label: string; quest: Quest; completion?: Completion; isShareLocked?: boolean }[] = [
  { label: 'todo-5',      quest: { ...BASE_QUEST, coins: 5 } },
  { label: 'todo-10',     quest: { ...BASE_QUEST, coins: 10 } },
  { label: 'todo-15',     quest: { ...BASE_QUEST, coins: 15 } },
  { label: 'todo-40',     quest: { ...BASE_QUEST, coins: 40 } },
  { label: 'todo-100',    quest: { ...BASE_QUEST, coins: 100 } },
  { label: 'approved-5',  quest: { ...BASE_QUEST, coins: 5 },  completion: COMPLETION('approved') },
  { label: 'approved-15', quest: { ...BASE_QUEST, coins: 15 }, completion: COMPLETION('approved') },
  { label: 'approved-40', quest: { ...BASE_QUEST, coins: 40 }, completion: COMPLETION('approved') },
  { label: 'pending-10',  quest: { ...BASE_QUEST, coins: 10 }, completion: COMPLETION('pending') },
  { label: 'rejected-5',  quest: { ...BASE_QUEST, coins: 5 },  completion: COMPLETION('rejected') },
  { label: 'locked-15',   quest: { ...BASE_QUEST, coins: 15 }, isShareLocked: true },
  { label: 'rare-15',     quest: { ...BASE_QUEST, coins: 15, tier: 'rare' } },
  { label: 'epic-40',     quest: { ...BASE_QUEST, coins: 40, tier: 'epic' } },
]

export default function QuestCardFixturePage() {
  return (
    <div
      className="bg-quest-void min-h-screen p-8"
      style={{ maxWidth: '400px' }}
    >
      <div className="flex flex-col gap-3">
        {CARDS.map(({ label, quest, completion, isShareLocked }) => (
          <div key={label} data-card={label}>
            <QuestCard
              quest={quest}
              completion={completion}
              isShareLocked={isShareLocked}
              kidColor="azure"
              onComplete={async () => {}}
              onUndo={async () => {}}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
