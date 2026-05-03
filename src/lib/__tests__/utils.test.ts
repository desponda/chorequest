import { describe, it, expect } from 'vitest'
import { isValidPin, questDateString, questWeekKey, localDateString } from '../utils'

describe('isValidPin', () => {
  it('accepts exactly 4 numeric digits', () => {
    expect(isValidPin('0000')).toBe(true)
    expect(isValidPin('1234')).toBe(true)
    expect(isValidPin('9999')).toBe(true)
  })

  it('rejects PINs that are too short', () => {
    expect(isValidPin('')).toBe(false)
    expect(isValidPin('1')).toBe(false)
    expect(isValidPin('123')).toBe(false)
  })

  it('rejects PINs that are too long', () => {
    expect(isValidPin('12345')).toBe(false)
    expect(isValidPin('00000')).toBe(false)
  })

  it('rejects PINs with non-numeric characters', () => {
    expect(isValidPin('abcd')).toBe(false)
    expect(isValidPin('12ab')).toBe(false)
    expect(isValidPin('12 4')).toBe(false)
    expect(isValidPin('12.4')).toBe(false)
    expect(isValidPin('12-4')).toBe(false)
  })

  it('rejects non-string values', () => {
    expect(isValidPin(1234)).toBe(false)
    expect(isValidPin(null)).toBe(false)
    expect(isValidPin(undefined)).toBe(false)
    expect(isValidPin([])).toBe(false)
    expect(isValidPin({ pin: '1234' })).toBe(false)
  })

  it('rejects PINs with leading/trailing whitespace', () => {
    expect(isValidPin(' 1234')).toBe(false)
    expect(isValidPin('1234 ')).toBe(false)
    expect(isValidPin(' 1234 ')).toBe(false)
  })
})

describe('questDateString', () => {
  const date = (h: number, min = 0) => {
    const d = new Date(2025, 5, 15, h, min) // 2025-06-15, local time
    return d
  }

  it('returns today when current hour is at or after resetHour', () => {
    expect(questDateString(0, date(0))).toBe('2025-06-15')   // midnight reset, midnight
    expect(questDateString(3, date(3))).toBe('2025-06-15')   // 3 AM reset, exactly 3 AM
    expect(questDateString(3, date(9))).toBe('2025-06-15')   // 3 AM reset, 9 AM
    expect(questDateString(6, date(23))).toBe('2025-06-15')  // 6 AM reset, 11 PM
  })

  it('returns yesterday when current hour is before resetHour', () => {
    expect(questDateString(3, date(2))).toBe('2025-06-14')   // 3 AM reset, 2 AM → still yesterday
    expect(questDateString(6, date(5))).toBe('2025-06-14')   // 6 AM reset, 5 AM → still yesterday
    expect(questDateString(3, date(0))).toBe('2025-06-14')   // 3 AM reset, midnight → still yesterday
  })

  it('defaults to midnight reset (resetHour=0)', () => {
    expect(questDateString(0, date(0))).toBe('2025-06-15')
    expect(questDateString(0, date(23, 59))).toBe('2025-06-15')
  })

  it('handles month boundary correctly', () => {
    const lastDayOfMonth = new Date(2025, 5, 1, 2) // June 1 at 2 AM, resetHour=3
    expect(questDateString(3, lastDayOfMonth)).toBe('2025-05-31') // rolls back to May 31
  })
})

describe('questWeekKey', () => {
  // 2025-06-15 is a Sunday; its Monday is 2025-06-09
  const date = (y: number, mo: number, d: number, h = 10) => new Date(y, mo - 1, d, h)

  it('returns the Monday of the week for any weekday', () => {
    expect(questWeekKey(0, date(2025, 6, 9))).toBe('2025-06-09')   // Monday
    expect(questWeekKey(0, date(2025, 6, 11))).toBe('2025-06-09')  // Wednesday
    expect(questWeekKey(0, date(2025, 6, 14))).toBe('2025-06-09')  // Saturday
    expect(questWeekKey(0, date(2025, 6, 15))).toBe('2025-06-09')  // Sunday
  })

  it('respects resetHour — before reset still belongs to the previous day', () => {
    // Mon June 9 at 2 AM, resetHour=3 → effective day is Sunday June 8
    // Sunday June 8's Monday is June 2
    expect(questWeekKey(3, date(2025, 6, 9, 2))).toBe('2025-06-02')

    // Mon June 9 at 4 AM (after 3 AM reset) → effective day is Monday June 9
    expect(questWeekKey(3, date(2025, 6, 9, 4))).toBe('2025-06-09')
  })

  it('handles cross-month boundary (Wednesday July 2 → Monday June 30)', () => {
    expect(questWeekKey(0, date(2025, 7, 2))).toBe('2025-06-30')
  })

  it('handles cross-year boundary (Wednesday Jan 1 2025 → Monday Dec 30 2024)', () => {
    expect(questWeekKey(0, date(2025, 1, 1))).toBe('2024-12-30')
  })
})

describe('localDateString', () => {
  it('formats a date as YYYY-MM-DD', () => {
    expect(localDateString(new Date(2025, 0, 1))).toBe('2025-01-01')
    expect(localDateString(new Date(2025, 11, 31))).toBe('2025-12-31')
    expect(localDateString(new Date(2025, 5, 9))).toBe('2025-06-09')
  })

  it('zero-pads month and day', () => {
    expect(localDateString(new Date(2025, 0, 9))).toBe('2025-01-09')
    expect(localDateString(new Date(2025, 8, 1))).toBe('2025-09-01')
  })
})
