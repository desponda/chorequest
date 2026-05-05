import { describe, it, expect } from 'vitest'
import { getLevelFromXP, getXPForLevel, getXPProgress, getLevelTitle, getWeekMonday, LEVEL_TITLES } from '../xp'

describe('getLevelFromXP', () => {
  it('starts at level 1 with 0 XP', () => {
    expect(getLevelFromXP(0)).toBe(1)
    expect(getLevelFromXP(99)).toBe(1)
  })

  it('reaches level 2 at 100 XP', () => {
    expect(getLevelFromXP(100)).toBe(2)
    expect(getLevelFromXP(249)).toBe(2)
  })

  it('handles thresholds for levels 3–10', () => {
    expect(getLevelFromXP(250)).toBe(3)
    expect(getLevelFromXP(500)).toBe(4)
    expect(getLevelFromXP(900)).toBe(5)
    expect(getLevelFromXP(1400)).toBe(6)
    expect(getLevelFromXP(2100)).toBe(7)
    expect(getLevelFromXP(3000)).toBe(8)
    expect(getLevelFromXP(4200)).toBe(9)
    expect(getLevelFromXP(6000)).toBe(10)
  })

  it('returns level 10 for XP just below level 11 threshold', () => {
    // Level 11 needs 6000 + (11 * 800) = 14800
    expect(getLevelFromXP(14799)).toBe(10)
    expect(getLevelFromXP(14800)).toBe(11)
  })

  it('keeps climbing past level 10', () => {
    expect(getLevelFromXP(100_000)).toBeGreaterThan(10)
  })
})

describe('getXPForLevel', () => {
  it('returns 0 for level 1', () => {
    expect(getXPForLevel(1)).toBe(0)
  })

  it('matches known thresholds', () => {
    expect(getXPForLevel(2)).toBe(100)
    expect(getXPForLevel(5)).toBe(900)
    expect(getXPForLevel(10)).toBe(6000)
  })

  it('is consistent with getLevelFromXP', () => {
    for (let lv = 1; lv <= 12; lv++) {
      const xp = getXPForLevel(lv)
      expect(getLevelFromXP(xp)).toBe(lv)
    }
  })
})

describe('getXPProgress', () => {
  it('shows 0% at level start', () => {
    const p = getXPProgress(0)
    expect(p.level).toBe(1)
    expect(p.pct).toBe(0)
    expect(p.currentXP).toBe(0)
  })

  it('shows 50% halfway through a level', () => {
    // Level 1 spans 0–99 (neededXP = 100). 50 XP = 50%.
    const p = getXPProgress(50)
    expect(p.level).toBe(1)
    expect(p.pct).toBe(50)
  })

  it('caps pct at 100', () => {
    // Level 10 threshold is 6000, level 11 threshold is 14800.
    // At exactly level 11 threshold, pct should be 0 for level 11 (or 100 capped for level 10).
    const p = getXPProgress(6000)
    expect(p.pct).toBeGreaterThanOrEqual(0)
    expect(p.pct).toBeLessThanOrEqual(100)
  })
})

describe('getLevelTitle', () => {
  it('returns correct titles for levels 1-10', () => {
    expect(getLevelTitle(1)).toBe('Apprentice')
    expect(getLevelTitle(6)).toBe('Hero')
    expect(getLevelTitle(10)).toBe('Mythic')
  })

  it('returns Mythic N for levels beyond 10', () => {
    expect(getLevelTitle(11)).toBe('Mythic 2')
    expect(getLevelTitle(15)).toBe('Mythic 6')
  })

  it('has 10 base titles defined', () => {
    expect(LEVEL_TITLES).toHaveLength(10)
  })
})

describe('getWeekMonday', () => {
  it('returns a valid YYYY-MM-DD string', () => {
    const monday = getWeekMonday()
    expect(monday).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('always returns a Monday', () => {
    const monday = getWeekMonday()
    const d = new Date(monday + 'T00:00:00')
    expect(d.getDay()).toBe(1) // 1 = Monday
  })
})
