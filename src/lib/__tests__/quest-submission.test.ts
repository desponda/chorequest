import { describe, expect, it } from 'vitest'
import type { Quest } from '../types'
import {
  canKidSubmitQuest,
  decideQuestSubmission,
  isCompletionInSubmissionPeriod,
  type SubmissionCompletion,
} from '../quest-submission'

const quest: Quest = {
  id: 'quest-1',
  family_id: 'family-1',
  title: 'Test quest',
  description: null,
  icon: 'q',
  coins: 10,
  assigned_to: null,
  kind: 'personal',
  frequency: 'daily',
  tier: 'normal',
  slots: 1,
  active: true,
  archived: false,
  active_days: null,
  created_at: '2026-05-01T00:00:00Z',
}

const rejected: SubmissionCompletion = {
  id: 'completion-1',
  kid_id: 'kid-1',
  status: 'rejected',
  date: '2026-05-05',
}

describe('canKidSubmitQuest', () => {
  it('accepts an active quest in the same family assigned to the kid', () => {
    expect(canKidSubmitQuest(quest, { id: 'kid-1', family_id: 'family-1' }, '2026-05-05')).toBe(true)
  })

  it('rejects cross-family, inactive, and differently assigned quests', () => {
    expect(canKidSubmitQuest(quest, { id: 'kid-1', family_id: 'other' }, '2026-05-05')).toBe(false)
    expect(canKidSubmitQuest({ ...quest, active: false }, { id: 'kid-1', family_id: 'family-1' }, '2026-05-05')).toBe(false)
    expect(canKidSubmitQuest({ ...quest, assigned_to: 'kid-2' }, { id: 'kid-1', family_id: 'family-1' }, '2026-05-05')).toBe(false)
  })

  it('uses the quest date for active-day checks', () => {
    expect(canKidSubmitQuest({ ...quest, active_days: [2] }, { id: 'kid-1', family_id: 'family-1' }, '2026-05-05')).toBe(true)
    expect(canKidSubmitQuest({ ...quest, active_days: [1] }, { id: 'kid-1', family_id: 'family-1' }, '2026-05-05')).toBe(false)
  })
})

describe('isCompletionInSubmissionPeriod', () => {
  it('scopes daily, weekly, and one-time quests correctly', () => {
    expect(isCompletionInSubmissionPeriod('daily', '2026-05-04', '2026-05-05')).toBe(false)
    expect(isCompletionInSubmissionPeriod('weekly', '2026-05-04', '2026-05-10')).toBe(true)
    expect(isCompletionInSubmissionPeriod('weekly', '2026-05-03', '2026-05-10')).toBe(false)
    expect(isCompletionInSubmissionPeriod('once', '2020-01-01', '2026-05-10')).toBe(true)
  })
})

describe('decideQuestSubmission', () => {
  it('revives a rejected same-day completion instead of attempting a duplicate insert', () => {
    expect(decideQuestSubmission(quest, 'kid-1', '2026-05-05', [rejected])).toEqual({
      action: 'retry',
      completionId: 'completion-1',
    })
  })

  it('does not revive pending or approved completions', () => {
    expect(decideQuestSubmission(quest, 'kid-1', '2026-05-05', [{ ...rejected, status: 'pending' }])).toEqual({
      action: 'reject',
      reason: 'already_submitted',
    })
  })

  it('enforces shared slots across the family', () => {
    const shared = { ...quest, kind: 'shared' as const, slots: 1 }
    expect(decideQuestSubmission(shared, 'kid-1', '2026-05-05', [{ ...rejected, kid_id: 'kid-2', status: 'approved' }])).toEqual({
      action: 'reject',
      reason: 'slots_full',
    })
  })

  it('enforces one-time claims across all dates', () => {
    const oneoff = { ...quest, kind: 'oneoff' as const, frequency: 'once' as const }
    expect(decideQuestSubmission(oneoff, 'kid-1', '2026-05-05', [{ ...rejected, kid_id: 'kid-2', status: 'pending', date: '2025-01-01' }])).toEqual({
      action: 'reject',
      reason: 'slots_full',
    })
  })
})
