import type { Completion, Quest } from './types'
import { dateKeyDayOfWeek } from './utils'

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
    const dayOfWeek = dateKeyDayOfWeek(todayIso)
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

/**
 * Returns a date-filter predicate scoped to the correct period for a shared quest:
 * - daily → only today's completions count
 * - weekly (or unset) → any completion since weekStart counts
 *
 * This is used both for the family-wide "claimed" slot count and for finding
 * a kid's own completion, so that daily shared quests reset every day and don't
 * stay locked for the whole week after a single completion.
 */
export function sharedQuestPeriodFilter(
  quest: Quest,
  today: string,
  weekStart: string,
): (date: string) => boolean {
  if (quest.frequency === 'daily') return (date) => date === today
  return (date) => date >= weekStart
}

/**
 * Returns how many family-wide slots have been claimed for the current period.
 * Respects the quest's frequency — daily quests only count today's completions.
 */
export function sharedClaimedCount(
  quest: Quest,
  familyCompletions: Completion[],
  today: string,
  weekStart: string,
): number {
  const inPeriod = sharedQuestPeriodFilter(quest, today, weekStart)
  return familyCompletions.filter(
    (c) => c.quest_id === quest.id && inPeriod(c.date) && (c.status === 'approved' || c.status === 'pending'),
  ).length
}

/**
 * Returns this kid's active completion for the quest in the current period, or undefined.
 * Respects the quest's frequency — daily quests only look at today's completions.
 */
export function kidCompletionForPeriod(
  quest: Quest,
  kidId: string,
  completions: Completion[],
  today: string,
  weekStart: string,
): Completion | undefined {
  const inPeriod = sharedQuestPeriodFilter(quest, today, weekStart)
  return completions.find(
    (c) => c.quest_id === quest.id && c.kid_id === kidId && inPeriod(c.date),
  )
}
