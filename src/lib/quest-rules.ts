import type { Completion, Quest } from './types'

/**
 * Returns true if `quest` is currently visible to a given kid on a given date.
 * Filters out: quests assigned to other kids, oneoffs already completed by anyone, and quests outside their active-days window.
 */
export function isQuestVisibleToKid(
  quest: Quest,
  kidId: string,
  todayIso: string,
  approvedQuestIdsAcrossFamily: Set<string>,
): boolean {
  if (quest.assigned_to && quest.assigned_to !== kidId) return false
  if (quest.kind === 'oneoff' && approvedQuestIdsAcrossFamily.has(quest.id)) return false
  if (quest.active_days?.length) {
    const dayOfWeek = new Date(todayIso).getDay()
    if (!quest.active_days.includes(dayOfWeek)) return false
  }
  return true
}

/**
 * Returns the count of completions matching `(quest_id, status in [pending, approved])` within the period
 * appropriate for the quest cadence. The caller passes in the candidate completion list (already scoped to
 * "this week" by the data layer); we just sum what's relevant.
 */
export function countActiveCompletions(quest: Quest, completions: Completion[]): number {
  return completions.filter((c) =>
    c.quest_id === quest.id && (c.status === 'approved' || c.status === 'pending'),
  ).length
}

/**
 * Returns the slot capacity remaining for a shared quest, or `null` for personal/oneoff
 * (where slot semantics are per-kid or n/a).
 */
export function sharedSlotsLeft(quest: Quest, familyCompletions: Completion[]): number | null {
  if (quest.kind !== 'shared') return null
  const claimed = countActiveCompletions(quest, familyCompletions)
  return Math.max(0, quest.slots - claimed)
}

/** Returns true if this kid has an active (pending/approved) completion for the quest in the current period. */
export function kidHasActiveCompletion(quest: Quest, kidId: string, completions: Completion[]): boolean {
  return completions.some((c) =>
    c.quest_id === quest.id &&
    c.kid_id === kidId &&
    (c.status === 'approved' || c.status === 'pending'),
  )
}
