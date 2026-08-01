import type { Quest } from './types'
import { dateKeyDayOfWeek, weekKeyForDate } from './utils'

export type SubmissionCompletion = {
  id: string
  kid_id: string
  status: 'pending' | 'approved' | 'rejected'
  date: string
}

export type SubmissionDecision =
  | { action: 'create' }
  | { action: 'retry'; completionId: string }
  | { action: 'reject'; reason: 'already_submitted' | 'slots_full' }

/** Validates the invariants that make a quest claimable by this kid. */
export function canKidSubmitQuest(
  quest: Pick<Quest, 'active' | 'active_days' | 'assigned_to' | 'family_id' | 'frequency' | 'kind' | 'slots'>,
  kid: { id: string; family_id: string },
  date: string,
): boolean {
  if (!quest.active || quest.family_id !== kid.family_id) return false
  if (quest.assigned_to && quest.assigned_to !== kid.id) return false
  if (!Number.isInteger(quest.slots) || quest.slots < 1) return false
  if (quest.kind === 'oneoff' && quest.frequency !== 'once') return false
  if (quest.kind !== 'oneoff' && quest.frequency === 'once') return false
  if (quest.active_days?.length && !quest.active_days.includes(dateKeyDayOfWeek(date))) return false
  return true
}

/** Returns whether a completion date belongs to this submission's cadence period. */
export function isCompletionInSubmissionPeriod(
  frequency: Quest['frequency'],
  completionDate: string,
  submissionDate: string,
): boolean {
  if (frequency === 'once') return true
  if (frequency === 'daily') return completionDate === submissionDate
  return completionDate >= weekKeyForDate(submissionDate) && completionDate <= submissionDate
}

/**
 * Chooses whether to create a row, revive a rejected row, or reject the claim.
 * The route supplies every completion for the quest in the relevant period.
 */
export function decideQuestSubmission(
  quest: Pick<Quest, 'frequency' | 'kind' | 'slots'>,
  kidId: string,
  submissionDate: string,
  completions: SubmissionCompletion[],
): SubmissionDecision {
  const inPeriod = completions.filter((completion) =>
    isCompletionInSubmissionPeriod(quest.frequency, completion.date, submissionDate),
  )
  const isActive = (completion: SubmissionCompletion) =>
    completion.status === 'pending' || completion.status === 'approved'

  if (inPeriod.some((completion) => completion.kid_id === kidId && isActive(completion))) {
    return { action: 'reject', reason: 'already_submitted' }
  }

  if (quest.kind === 'oneoff' && inPeriod.some(isActive)) {
    return { action: 'reject', reason: 'slots_full' }
  }

  if (quest.kind === 'shared' && inPeriod.filter(isActive).length >= quest.slots) {
    return { action: 'reject', reason: 'slots_full' }
  }

  const rejected = inPeriod
    .filter((completion) => completion.kid_id === kidId && completion.status === 'rejected')
    .sort((a, b) => b.date.localeCompare(a.date))[0]

  return rejected
    ? { action: 'retry', completionId: rejected.id }
    : { action: 'create' }
}
