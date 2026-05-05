import { describe, it, expect } from 'vitest'
import { PLAN_LIMITS, PLAN_LABELS, PLAN_UPGRADE_HINT } from '../plans'
import type { Plan } from '../types'

const PLANS: Plan[] = ['free', 'family', 'legendary']

describe('PLAN_LIMITS', () => {
  it('defines limits for every plan', () => {
    for (const plan of PLANS) {
      expect(PLAN_LIMITS[plan]).toBeDefined()
    }
  })

  describe('free tier', () => {
    const limits = PLAN_LIMITS.free

    it('caps kids at 2', () => {
      expect(limits.maxKids).toBe(2)
    })

    it('caps quests at 5', () => {
      expect(limits.maxQuests).toBe(5)
    })

    it('caps rewards at 3', () => {
      expect(limits.maxRewards).toBe(3)
    })

    it('disables curses', () => {
      expect(limits.curses).toBe(false)
    })

    it('disables quest tiers', () => {
      expect(limits.questTiers).toBe(false)
    })

    it('disables active days', () => {
      expect(limits.activeDays).toBe(false)
    })
  })

  describe('family tier', () => {
    const limits = PLAN_LIMITS.family

    it('has no kid cap', () => {
      expect(limits.maxKids).toBe(Infinity)
    })

    it('has no quest cap', () => {
      expect(limits.maxQuests).toBe(Infinity)
    })

    it('has no reward cap', () => {
      expect(limits.maxRewards).toBe(Infinity)
    })

    it('enables curses', () => {
      expect(limits.curses).toBe(true)
    })

    it('disables quest tiers', () => {
      expect(limits.questTiers).toBe(false)
    })

    it('disables active days', () => {
      expect(limits.activeDays).toBe(false)
    })
  })

  describe('legendary tier', () => {
    const limits = PLAN_LIMITS.legendary

    it('has no kid cap', () => {
      expect(limits.maxKids).toBe(Infinity)
    })

    it('has no quest cap', () => {
      expect(limits.maxQuests).toBe(Infinity)
    })

    it('has no reward cap', () => {
      expect(limits.maxRewards).toBe(Infinity)
    })

    it('enables curses', () => {
      expect(limits.curses).toBe(true)
    })

    it('enables quest tiers', () => {
      expect(limits.questTiers).toBe(true)
    })

    it('enables active days', () => {
      expect(limits.activeDays).toBe(true)
    })
  })

  it('each higher tier has a superset of features vs the tier below', () => {
    // family enables everything free has, plus curses
    expect(PLAN_LIMITS.family.maxKids).toBeGreaterThanOrEqual(PLAN_LIMITS.free.maxKids)
    expect(PLAN_LIMITS.family.maxQuests).toBeGreaterThanOrEqual(PLAN_LIMITS.free.maxQuests)
    expect(PLAN_LIMITS.family.maxRewards).toBeGreaterThanOrEqual(PLAN_LIMITS.free.maxRewards)

    // legendary enables everything family has, plus more
    expect(PLAN_LIMITS.legendary.maxKids).toBeGreaterThanOrEqual(PLAN_LIMITS.family.maxKids)
    expect(PLAN_LIMITS.legendary.maxQuests).toBeGreaterThanOrEqual(PLAN_LIMITS.family.maxQuests)
    expect(PLAN_LIMITS.legendary.maxRewards).toBeGreaterThanOrEqual(PLAN_LIMITS.family.maxRewards)
  })

  it('can be used to gate a feature with a simple boolean check', () => {
    const canUseCurses = (plan: Plan) => PLAN_LIMITS[plan].curses
    expect(canUseCurses('free')).toBe(false)
    expect(canUseCurses('family')).toBe(true)
    expect(canUseCurses('legendary')).toBe(true)
  })

  it('can be used to enforce a numeric limit', () => {
    const withinKidLimit = (plan: Plan, count: number) => count <= PLAN_LIMITS[plan].maxKids
    expect(withinKidLimit('free', 2)).toBe(true)
    expect(withinKidLimit('free', 3)).toBe(false)
    expect(withinKidLimit('family', 100)).toBe(true)
    expect(withinKidLimit('legendary', 100)).toBe(true)
  })
})

describe('PLAN_LABELS', () => {
  it('has a label for every plan', () => {
    for (const plan of PLANS) {
      expect(typeof PLAN_LABELS[plan]).toBe('string')
      expect(PLAN_LABELS[plan].length).toBeGreaterThan(0)
    }
  })

  it('free label is "Free"', () => {
    expect(PLAN_LABELS.free).toBe('Free')
  })

  it('family label is "Family"', () => {
    expect(PLAN_LABELS.family).toBe('Family')
  })

  it('legendary label is "Legendary"', () => {
    expect(PLAN_LABELS.legendary).toBe('Legendary')
  })
})

describe('PLAN_UPGRADE_HINT', () => {
  it('has a hint for every plan', () => {
    for (const plan of PLANS) {
      expect(PLAN_UPGRADE_HINT[plan]).toBeDefined()
    }
  })

  it('free hint points to Family plan', () => {
    expect(PLAN_UPGRADE_HINT.free).toMatch(/family/i)
  })

  it('family hint points to Legendary plan', () => {
    expect(PLAN_UPGRADE_HINT.family).toMatch(/legendary/i)
  })

  it('legendary has no upgrade hint (already top tier)', () => {
    expect(PLAN_UPGRADE_HINT.legendary).toBe('')
  })
})
