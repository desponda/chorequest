import { describe, it, expect } from 'vitest'
import type { Quest, Completion } from '../types'
import {
  isQuestVisibleToKid,
  countActiveCompletions,
  sharedSlotsLeft,
  kidHasActiveCompletion,
  sharedQuestPeriodFilter,
  sharedClaimedCount,
  kidCompletionForPeriod,
} from '../quest-rules'

const TODAY = '2026-05-05'
const YESTERDAY = '2026-05-04'
const WEEK_START = '2026-04-28' // Monday of the week containing TODAY

const baseQuest: Quest = {
  id: 'q1',
  family_id: 'f1',
  title: 'Test',
  description: null,
  icon: '⚔️',
  coins: 10,
  assigned_to: null,
  kind: 'personal',
  frequency: 'daily',
  tier: 'normal',
  slots: 1,
  active: true,
  active_days: null,
  created_at: new Date().toISOString(),
}

const baseCompletion: Completion = {
  id: 'c1',
  quest_id: 'q1',
  kid_id: 'kid-a',
  status: 'pending',
  completed_at: new Date().toISOString(),
  approved_at: null,
  coins_awarded: null,
  date: TODAY,
}

// ─── isQuestVisibleToKid ─────────────────────────────────────────────────────

describe('isQuestVisibleToKid', () => {
  it('shows quests with no assignee to any kid', () => {
    expect(isQuestVisibleToKid(baseQuest, 'kid-a', TODAY, new Set())).toBe(true)
  })

  it('hides quests assigned to a different kid', () => {
    const q = { ...baseQuest, assigned_to: 'kid-b' }
    expect(isQuestVisibleToKid(q, 'kid-a', TODAY, new Set())).toBe(false)
  })

  it('shows quests assigned to this kid', () => {
    const q = { ...baseQuest, assigned_to: 'kid-a' }
    expect(isQuestVisibleToKid(q, 'kid-a', TODAY, new Set())).toBe(true)
  })

  it('hides oneoff quests already approved by anyone in the family', () => {
    const q = { ...baseQuest, kind: 'oneoff' as const, frequency: 'once' as const }
    expect(isQuestVisibleToKid(q, 'kid-a', TODAY, new Set(['q1']))).toBe(false)
  })

  it('shows oneoff quests not yet approved', () => {
    const q = { ...baseQuest, kind: 'oneoff' as const, frequency: 'once' as const }
    expect(isQuestVisibleToKid(q, 'kid-a', TODAY, new Set())).toBe(true)
  })

  it('respects active_days filter', () => {
    const dow = new Date(TODAY).getDay()
    const otherDay = (dow + 1) % 7
    const q = { ...baseQuest, active_days: [otherDay] }
    expect(isQuestVisibleToKid(q, 'kid-a', TODAY, new Set())).toBe(false)

    const q2 = { ...baseQuest, active_days: [dow] }
    expect(isQuestVisibleToKid(q2, 'kid-a', TODAY, new Set())).toBe(true)
  })

  it('treats empty active_days as "every day"', () => {
    const q = { ...baseQuest, active_days: [] }
    expect(isQuestVisibleToKid(q, 'kid-a', TODAY, new Set())).toBe(true)
  })

  it('shows shared quests to all kids — approved family completions do NOT hide them', () => {
    const q = { ...baseQuest, kind: 'shared' as const, assigned_to: null }
    expect(isQuestVisibleToKid(q, 'kid-a', TODAY, new Set(['q1']))).toBe(true)
    expect(isQuestVisibleToKid(q, 'kid-b', TODAY, new Set(['q1']))).toBe(true)
  })

  it('active_days with all 7 days behaves like no filter', () => {
    const q = { ...baseQuest, active_days: [0, 1, 2, 3, 4, 5, 6] }
    expect(isQuestVisibleToKid(q, 'kid-a', TODAY, new Set())).toBe(true)
  })
})

// ─── countActiveCompletions ──────────────────────────────────────────────────

describe('countActiveCompletions', () => {
  it('counts pending and approved, ignoring rejected', () => {
    const completions: Completion[] = [
      { ...baseCompletion, id: 'a', status: 'pending' },
      { ...baseCompletion, id: 'b', status: 'approved' },
      { ...baseCompletion, id: 'c', status: 'rejected' },
      { ...baseCompletion, id: 'd', quest_id: 'other', status: 'approved' },
    ]
    expect(countActiveCompletions(baseQuest, completions)).toBe(2)
  })

  it('returns 0 with no completions', () => {
    expect(countActiveCompletions(baseQuest, [])).toBe(0)
  })

  it('does not count completions for other quests', () => {
    const completions: Completion[] = [
      { ...baseCompletion, id: 'a', quest_id: 'other-quest', status: 'approved' },
      { ...baseCompletion, id: 'b', quest_id: 'another', status: 'pending' },
    ]
    expect(countActiveCompletions(baseQuest, completions)).toBe(0)
  })

  it('counts completions from multiple kids (shared quest scenario)', () => {
    const completions: Completion[] = [
      { ...baseCompletion, id: 'a', kid_id: 'kid-a', status: 'approved' },
      { ...baseCompletion, id: 'b', kid_id: 'kid-b', status: 'pending' },
      { ...baseCompletion, id: 'c', kid_id: 'kid-c', status: 'approved' },
    ]
    expect(countActiveCompletions(baseQuest, completions)).toBe(3)
  })
})

// ─── sharedSlotsLeft ─────────────────────────────────────────────────────────

describe('sharedSlotsLeft', () => {
  it('returns null for personal quests', () => {
    expect(sharedSlotsLeft(baseQuest, [])).toBeNull()
  })

  it('returns null for oneoff quests', () => {
    const q = { ...baseQuest, kind: 'oneoff' as const }
    expect(sharedSlotsLeft(q, [])).toBeNull()
  })

  it('returns slots minus active completions for shared quests', () => {
    const q = { ...baseQuest, kind: 'shared' as const, slots: 3 }
    const completions: Completion[] = [
      { ...baseCompletion, id: 'a', status: 'approved' },
      { ...baseCompletion, id: 'b', status: 'pending' },
    ]
    expect(sharedSlotsLeft(q, completions)).toBe(1)
  })

  it('clamps to 0 when over-claimed', () => {
    const q = { ...baseQuest, kind: 'shared' as const, slots: 1 }
    const completions: Completion[] = [
      { ...baseCompletion, id: 'a', status: 'approved' },
      { ...baseCompletion, id: 'b', status: 'pending' },
    ]
    expect(sharedSlotsLeft(q, completions)).toBe(0)
  })
})

// ─── kidHasActiveCompletion ──────────────────────────────────────────────────

describe('kidHasActiveCompletion', () => {
  it('returns true when kid has pending', () => {
    const completions: Completion[] = [{ ...baseCompletion, status: 'pending' }]
    expect(kidHasActiveCompletion(baseQuest, 'kid-a', completions)).toBe(true)
  })

  it('returns true for approved', () => {
    const completions: Completion[] = [{ ...baseCompletion, status: 'approved' }]
    expect(kidHasActiveCompletion(baseQuest, 'kid-a', completions)).toBe(true)
  })

  it('returns false when only rejected', () => {
    const completions: Completion[] = [{ ...baseCompletion, status: 'rejected' }]
    expect(kidHasActiveCompletion(baseQuest, 'kid-a', completions)).toBe(false)
  })

  it('returns false with empty completions list', () => {
    expect(kidHasActiveCompletion(baseQuest, 'kid-a', [])).toBe(false)
  })

  it('returns false for other kids even if they have active completions', () => {
    const completions: Completion[] = [{ ...baseCompletion, kid_id: 'kid-b', status: 'approved' }]
    expect(kidHasActiveCompletion(baseQuest, 'kid-a', completions)).toBe(false)
  })

  it('returns false for other quests even for the same kid', () => {
    const completions: Completion[] = [{ ...baseCompletion, quest_id: 'other', status: 'approved' }]
    expect(kidHasActiveCompletion(baseQuest, 'kid-a', completions)).toBe(false)
  })
})

// ─── sharedQuestPeriodFilter ─────────────────────────────────────────────────

describe('sharedQuestPeriodFilter', () => {
  const dailyQuest = { ...baseQuest, kind: 'shared' as const, frequency: 'daily' as const }
  const weeklyQuest = { ...baseQuest, kind: 'shared' as const, frequency: 'weekly' as const }

  it('daily quest: only matches today', () => {
    const filter = sharedQuestPeriodFilter(dailyQuest, TODAY, WEEK_START)
    expect(filter(TODAY)).toBe(true)
    expect(filter(YESTERDAY)).toBe(false)
    expect(filter(WEEK_START)).toBe(false)
  })

  it('weekly quest: matches today and earlier dates within the week', () => {
    const filter = sharedQuestPeriodFilter(weeklyQuest, TODAY, WEEK_START)
    expect(filter(TODAY)).toBe(true)
    expect(filter(YESTERDAY)).toBe(true)
    expect(filter(WEEK_START)).toBe(true)
  })

  it('weekly quest: rejects dates before the week', () => {
    const filter = sharedQuestPeriodFilter(weeklyQuest, TODAY, WEEK_START)
    expect(filter('2026-04-27')).toBe(false) // day before WEEK_START
  })
})

// ─── sharedClaimedCount ──────────────────────────────────────────────────────

describe('sharedClaimedCount', () => {
  const sharedDaily = { ...baseQuest, kind: 'shared' as const, frequency: 'daily' as const, slots: 2 }
  const sharedWeekly = { ...baseQuest, kind: 'shared' as const, frequency: 'weekly' as const, slots: 2 }

  it('daily: only counts completions from today', () => {
    const completions: Completion[] = [
      { ...baseCompletion, id: 'a', kid_id: 'kid-a', date: TODAY, status: 'approved' },
      { ...baseCompletion, id: 'b', kid_id: 'kid-b', date: YESTERDAY, status: 'approved' }, // old — should not count
    ]
    expect(sharedClaimedCount(sharedDaily, completions, TODAY, WEEK_START)).toBe(1)
  })

  it('daily: counts pending and approved from today, ignores rejected', () => {
    const completions: Completion[] = [
      { ...baseCompletion, id: 'a', kid_id: 'kid-a', date: TODAY, status: 'approved' },
      { ...baseCompletion, id: 'b', kid_id: 'kid-b', date: TODAY, status: 'pending' },
      { ...baseCompletion, id: 'c', kid_id: 'kid-c', date: TODAY, status: 'rejected' },
    ]
    expect(sharedClaimedCount(sharedDaily, completions, TODAY, WEEK_START)).toBe(2)
  })

  it('daily: returns 0 when only yesterday completions exist (quest resets)', () => {
    const completions: Completion[] = [
      { ...baseCompletion, id: 'a', kid_id: 'kid-a', date: YESTERDAY, status: 'approved' },
    ]
    expect(sharedClaimedCount(sharedDaily, completions, TODAY, WEEK_START)).toBe(0)
  })

  it('weekly: counts completions across the whole week', () => {
    const completions: Completion[] = [
      { ...baseCompletion, id: 'a', kid_id: 'kid-a', date: WEEK_START, status: 'approved' },
      { ...baseCompletion, id: 'b', kid_id: 'kid-b', date: YESTERDAY, status: 'approved' },
    ]
    expect(sharedClaimedCount(sharedWeekly, completions, TODAY, WEEK_START)).toBe(2)
  })

  it('weekly: excludes completions from before the week', () => {
    const completions: Completion[] = [
      { ...baseCompletion, id: 'a', kid_id: 'kid-a', date: '2026-04-27', status: 'approved' }, // before week
      { ...baseCompletion, id: 'b', kid_id: 'kid-b', date: YESTERDAY, status: 'approved' },
    ]
    expect(sharedClaimedCount(sharedWeekly, completions, TODAY, WEEK_START)).toBe(1)
  })

  it('does not count completions for other quests', () => {
    const completions: Completion[] = [
      { ...baseCompletion, id: 'a', quest_id: 'other', date: TODAY, status: 'approved' },
    ]
    expect(sharedClaimedCount(sharedDaily, completions, TODAY, WEEK_START)).toBe(0)
  })
})

// ─── kidCompletionForPeriod ───────────────────────────────────────────────────

describe('kidCompletionForPeriod', () => {
  const sharedDaily = { ...baseQuest, kind: 'shared' as const, frequency: 'daily' as const }
  const sharedWeekly = { ...baseQuest, kind: 'shared' as const, frequency: 'weekly' as const }

  it('daily: finds today completion', () => {
    const c = { ...baseCompletion, date: TODAY, status: 'approved' as const }
    expect(kidCompletionForPeriod(sharedDaily, 'kid-a', [c], TODAY, WEEK_START)).toBe(c)
  })

  it('daily: returns undefined for yesterday completion — quest has reset', () => {
    // This is the core bug scenario: kid completed yesterday, approved today.
    // Quest should be available again → no completion found for today.
    const c = { ...baseCompletion, date: YESTERDAY, status: 'approved' as const }
    expect(kidCompletionForPeriod(sharedDaily, 'kid-a', [c], TODAY, WEEK_START)).toBeUndefined()
  })

  it('daily: returns undefined when only other kids completed today', () => {
    const c = { ...baseCompletion, kid_id: 'kid-b', date: TODAY, status: 'approved' as const }
    expect(kidCompletionForPeriod(sharedDaily, 'kid-a', [c], TODAY, WEEK_START)).toBeUndefined()
  })

  it('daily: picks up pending completion from today', () => {
    const c = { ...baseCompletion, date: TODAY, status: 'pending' as const }
    expect(kidCompletionForPeriod(sharedDaily, 'kid-a', [c], TODAY, WEEK_START)).toBe(c)
  })

  it('weekly: finds completion from earlier this week', () => {
    const c = { ...baseCompletion, date: YESTERDAY, status: 'approved' as const }
    expect(kidCompletionForPeriod(sharedWeekly, 'kid-a', [c], TODAY, WEEK_START)).toBe(c)
  })

  it('weekly: finds completion from the start of the week', () => {
    const c = { ...baseCompletion, date: WEEK_START, status: 'approved' as const }
    expect(kidCompletionForPeriod(sharedWeekly, 'kid-a', [c], TODAY, WEEK_START)).toBe(c)
  })

  it('weekly: returns undefined for completion from last week', () => {
    const c = { ...baseCompletion, date: '2026-04-27', status: 'approved' as const }
    expect(kidCompletionForPeriod(sharedWeekly, 'kid-a', [c], TODAY, WEEK_START)).toBeUndefined()
  })

  it('weekly: does not return another kid\'s completion', () => {
    const c = { ...baseCompletion, kid_id: 'kid-b', date: YESTERDAY, status: 'approved' as const }
    expect(kidCompletionForPeriod(sharedWeekly, 'kid-a', [c], TODAY, WEEK_START)).toBeUndefined()
  })
})
