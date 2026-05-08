export { getStreakBonus } from '@/lib/constants'

/**
 * Returns the quest-day before today, respecting resetHour.
 * e.g. at 2 AM with resetHour=6, quest-today is still "yesterday" in calendar terms,
 * so quest-yesterday is the day before that.
 */
export function yesterday(resetHour = 0): string {
  const d = new Date()
  if (d.getHours() < resetHour) d.setDate(d.getDate() - 1) // roll to quest-today
  d.setDate(d.getDate() - 1) // one quest-day back
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
