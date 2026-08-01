import { describe, expect, it } from 'vitest'
import { calculateStreak } from '../streak'

describe('calculateStreak', () => {
  it('returns an empty state with no approved dates', () => {
    expect(calculateStreak([])).toEqual({ streak: 0, lastCompletedDate: null })
  })

  it('counts distinct consecutive quest dates ending at the latest approval', () => {
    expect(calculateStreak(['2026-05-03', '2026-05-05', '2026-05-04', '2026-05-05'])).toEqual({
      streak: 3,
      lastCompletedDate: '2026-05-05',
    })
  })

  it('stops at a gap and is independent of approval order', () => {
    expect(calculateStreak(['2026-05-01', '2026-05-05', '2026-05-04'])).toEqual({
      streak: 2,
      lastCompletedDate: '2026-05-05',
    })
  })

  it('handles month and year boundaries', () => {
    expect(calculateStreak(['2025-12-30', '2025-12-31', '2026-01-01'])).toEqual({
      streak: 3,
      lastCompletedDate: '2026-01-01',
    })
  })
})
