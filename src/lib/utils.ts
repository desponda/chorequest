import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Returns true if `pin` is a valid 4-digit numeric string. */
export function isValidPin(pin: unknown): pin is string {
  return typeof pin === 'string' && /^\d{4}$/.test(pin)
}

/** Returns a date as YYYY-MM-DD in the browser's local timezone. */
export function localDateString(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Returns true when `value` is a real calendar date in YYYY-MM-DD form. */
export function isDateKey(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false

  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
}

/**
 * Returns the weekday for a YYYY-MM-DD quest key (0=Sunday ... 6=Saturday).
 * Date-only strings are parsed as UTC by JavaScript, so using `getDay()` would
 * shift them to the previous day in negative-offset timezones.
 */
export function dateKeyDayOfWeek(dateKey: string): number {
  if (!isDateKey(dateKey)) throw new RangeError(`Invalid date key: ${dateKey}`)
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay()
}

/** Returns the Monday containing a valid YYYY-MM-DD quest key. */
export function weekKeyForDate(dateKey: string): string {
  if (!isDateKey(dateKey)) throw new RangeError(`Invalid date key: ${dateKey}`)
  const [year, month, day] = dateKey.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  const weekday = date.getUTCDay()
  date.setUTCDate(date.getUTCDate() - (weekday === 0 ? 6 : weekday - 1))
  return date.toISOString().slice(0, 10)
}

/**
 * Returns the effective quest-day date string (YYYY-MM-DD).
 * Before `resetHour` each day, completions still belong to the previous day.
 * e.g. resetHour=3 means dailies reset at 3 AM — 1 AM is still "yesterday".
 */
export function questDateString(resetHour = 0, now = new Date()): string {
  const effective = new Date(now)
  if (now.getHours() < resetHour) {
    effective.setDate(effective.getDate() - 1)
  }
  return localDateString(effective)
}

/**
 * Returns the Monday of the current quest-week as YYYY-MM-DD.
 * Used to scope "weekly" and weekly_target quest completions.
 */
export function questWeekKey(resetHour = 0, now = new Date()): string {
  const effective = new Date(now)
  if (now.getHours() < resetHour) {
    effective.setDate(effective.getDate() - 1)
  }
  const day = effective.getDay() // 0=Sun … 6=Sat
  const daysFromMonday = day === 0 ? 6 : day - 1
  const monday = new Date(effective)
  monday.setDate(effective.getDate() - daysFromMonday)
  return localDateString(monday)
}

/** Returns the effective quest date in a family's configured IANA timezone. */
export function questDateStringForZone(resetHour: number, timeZone: string, now = new Date()): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(now).map(({ type, value }) => [type, value]),
  )
  const dateKey = `${parts.year}-${parts.month}-${parts.day}`
  if (Number(parts.hour) >= resetHour) return dateKey

  const [year, month, day] = dateKey.split('-').map(Number)
  const previous = new Date(Date.UTC(year, month - 1, day))
  previous.setUTCDate(previous.getUTCDate() - 1)
  return previous.toISOString().slice(0, 10)
}

/** Returns the Monday containing the family's current effective quest date. */
export function questWeekKeyForZone(resetHour: number, timeZone: string, now = new Date()): string {
  return weekKeyForDate(questDateStringForZone(resetHour, timeZone, now))
}
