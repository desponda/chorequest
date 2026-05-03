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
