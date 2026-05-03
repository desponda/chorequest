import { describe, it, expect } from 'vitest'
import type { Quest, Completion } from '../types'
import {
  isQuestVisibleToKid,
  countActiveCompletions,
  sharedSlotsLeft,
  kidHasActiveCompletion,
} from '../quest-rules'

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
  date: '2026-05-03',
}

describe('isQuestVisibleToKid', () => {
  const today = '2026-05-03' // a Sunday (UTC) — getDay() depends on local TZ; assert against local

  it('shows quests with no assignee to any kid', () => {
    expect(isQuestVisibleToKid(baseQuest, 'kid-a', today, new Set())).toBe(true)
  })

  it('hides quests assigned to a different kid', () => {
    const q = { ...baseQuest, assigned_to: 'kid-b' }
    expect(isQuestVisibleToKid(q, 'kid-a', today, new Set())).toBe(false)
  })

  it('shows quests assigned to this kid', () => {
    const q = { ...baseQuest, assigned_to: 'kid-a' }
    expect(isQuestVisibleToKid(q, 'kid-a', today, new Set())).toBe(true)
  })

  it('hides oneoff quests already approved by anyone in the family', () => {
    const q = { ...baseQuest, kind: 'oneoff' as const, frequency: 'once' as const }
    expect(isQuestVisibleToKid(q, 'kid-a', today, new Set(['q1']))).toBe(false)
  })

  it('shows oneoff quests not yet approved', () => {
    const q = { ...baseQuest, kind: 'oneoff' as const, frequency: 'once' as const }
    expect(isQuestVisibleToKid(q, 'kid-a', today, new Set())).toBe(true)
  })

  it('respects active_days filter', () => {
    const dow = new Date(today).getDay()
    const otherDay = (dow + 1) % 7
    const q = { ...baseQuest, active_days: [otherDay] }
    expect(isQuestVisibleToKid(q, 'kid-a', today, new Set())).toBe(false)

    const q2 = { ...baseQuest, active_days: [dow] }
    expect(isQuestVisibleToKid(q2, 'kid-a', today, new Set())).toBe(true)
  })

  it('treats empty active_days as "every day"', () => {
    const q = { ...baseQuest, active_days: [] }
    expect(isQuestVisibleToKid(q, 'kid-a', today, new Set())).toBe(true)
  })

  it('shows shared quests to all kids — approved family completions do NOT hide them', () => {
    const q = { ...baseQuest, kind: 'shared' as const, assigned_to: null }
    // shared quests stay visible even when they appear in the approvedSet
    // (they're not oneoff — they reset each period)
    expect(isQuestVisibleToKid(q, 'kid-a', today, new Set(['q1']))).toBe(true)
    expect(isQuestVisibleToKid(q, 'kid-b', today, new Set(['q1']))).toBe(true)
  })

  it('active_days with all 7 days behaves like no filter', () => {
    const q = { ...baseQuest, active_days: [0, 1, 2, 3, 4, 5, 6] }
    expect(isQuestVisibleToKid(q, 'kid-a', today, new Set())).toBe(true)
  })
})

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

describe('kidHasActiveCompletion', () => {
  it('returns true when kid has pending or approved', () => {
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
