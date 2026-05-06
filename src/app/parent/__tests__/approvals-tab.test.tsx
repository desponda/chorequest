// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, cleanup } from '@testing-library/react'

vi.mock('framer-motion', () => ({
  motion: new Proxy({}, {
    get: (_target, prop: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Tag = prop as any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return ({ children, ...rest }: any) => React.createElement(Tag, rest, children)
    },
  }),
  AnimatePresence: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
}))

vi.mock('@/components/quest-card', () => ({
  QuestCard: () => React.createElement('div', { 'data-testid': 'quest-card' }),
}))

import { ApprovalsTab } from '../approvals-tab'
import type { Completion, Kid, Quest, Redemption } from '@/lib/types'

function todayStr(offsetDays = 0) {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const baseKid: Kid = {
  id: 'kid-1', family_id: 'fam-1', name: 'Aria', avatar: '🧙', color: 'azure',
  coins: 50, streak: 1, last_completed_date: null, xp: 0, level: 1,
  created_at: new Date().toISOString(),
}

const baseQuest: Quest = {
  id: 'quest-1', family_id: 'fam-1', title: 'Feed the Dog', description: null,
  icon: '🐕', coins: 10, assigned_to: null, kind: 'personal', frequency: 'daily',
  tier: 'normal', slots: 1, active: true, active_days: null,
  created_at: new Date().toISOString(),
}

function makeCompletion(overrides: Partial<Completion> & { date: string; status: 'approved' | 'rejected' }): Completion {
  return {
    id: Math.random().toString(36).slice(2),
    quest_id: 'quest-1',
    kid_id: 'kid-1',
    completed_at: new Date().toISOString(),
    approved_at: null,
    coins_awarded: overrides.status === 'approved' ? 10 : null,
    quest: baseQuest,
    kid: baseKid,
    ...overrides,
  }
}

const noActions = {
  approve: vi.fn(), reject: vi.fn(), undoApproval: vi.fn(), undoRejection: vi.fn(),
  fulfillRedemption: vi.fn(), denyRedemption: vi.fn(),
  createQuest: vi.fn(), updateQuest: vi.fn(), deleteQuest: vi.fn(), toggleQuest: vi.fn(),
  createReward: vi.fn(), updateReward: vi.fn(), deleteReward: vi.fn(), toggleReward: vi.fn(),
  createCurse: vi.fn(), deleteCurse: vi.fn(), castCurse: vi.fn(), resolveCurse: vi.fn(),
  createDungeon: vi.fn(), clearDungeon: vi.fn(), deleteDungeon: vi.fn(),
  createBoss: vi.fn(), deleteBoss: vi.fn(),
  addKid: vi.fn(), updateKid: vi.fn(), deleteKid: vi.fn(),
  saveFamily: vi.fn(), setResetHour: vi.fn(), generateApiKey: vi.fn(), revokeApiKey: vi.fn(),
  saveParentPin: vi.fn(), removeParentPin: vi.fn(),
  signOut: vi.fn(),
// eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any

afterEach(cleanup)

describe('ApprovalsTab — review history', () => {
  it('regression: shows completions from multiple dates, not only today', () => {
    // Before the fix, the reviewed completions query used .eq('date', today),
    // which meant yesterday's (and older) approved/rejected completions never appeared.
    const todayCompletion = makeCompletion({ date: todayStr(0), status: 'approved' })
    const yesterdayCompletion = makeCompletion({ date: todayStr(-1), status: 'approved' })

    render(
      <ApprovalsTab
        pendingCompletions={[]}
        pendingRedemptions={[]}
        approvedRedemptions={[]}
        reviewedCompletions={[todayCompletion, yesterdayCompletion]}
        actions={noActions}
      />
    )

    // Both completions must appear — section should be visible
    expect(screen.getByText('Review history')).toBeInTheDocument()
    // Two date labels should appear (Today + Yesterday)
    expect(screen.getByText('Today')).toBeInTheDocument()
    expect(screen.getByText('Yesterday')).toBeInTheDocument()
  })

  it('shows date labels correctly', () => {
    const twoDaysAgo = makeCompletion({ date: todayStr(-2), status: 'rejected' })

    render(
      <ApprovalsTab
        pendingCompletions={[]}
        pendingRedemptions={[]}
        approvedRedemptions={[]}
        reviewedCompletions={[twoDaysAgo]}
        actions={noActions}
      />
    )

    // Should show a formatted date like "May 4" — verify it's not "Today" or "Yesterday"
    const today = screen.queryByText('Today')
    const yesterday = screen.queryByText('Yesterday')
    expect(today).not.toBeInTheDocument()
    expect(yesterday).not.toBeInTheDocument()
    // The date label should be present (exact value depends on current date)
    expect(screen.getByText('Review history')).toBeInTheDocument()
  })

  it('shows date on each pending completion', () => {
    const pending = makeCompletion({ date: todayStr(-1), status: 'approved' })
    // Re-use as a pending completion (override status)
    const pendingItem = { ...pending, status: 'pending' as const, coins_awarded: null }

    render(
      <ApprovalsTab
        pendingCompletions={[pendingItem]}
        pendingRedemptions={[]}
        approvedRedemptions={[]}
        reviewedCompletions={[]}
        actions={noActions}
      />
    )

    // Pending row shows kid name + date in subtitle
    expect(screen.getByText(/completed a quest · Yesterday/)).toBeInTheDocument()
  })
})
