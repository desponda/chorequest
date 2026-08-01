import { isDateKey } from './utils'

export type StreakState = {
  streak: number
  lastCompletedDate: string | null
}

/** Calculates a streak from the distinct quest dates that have approved completions. */
export function calculateStreak(approvedDates: string[]): StreakState {
  const dates = [...new Set(approvedDates.filter(isDateKey))].sort().reverse()
  if (dates.length === 0) return { streak: 0, lastCompletedDate: null }

  let streak = 1
  const cursor = new Date(`${dates[0]}T00:00:00Z`)

  for (const date of dates.slice(1)) {
    cursor.setUTCDate(cursor.getUTCDate() - 1)
    if (date !== cursor.toISOString().slice(0, 10)) break
    streak += 1
  }

  return { streak, lastCompletedDate: dates[0] }
}
