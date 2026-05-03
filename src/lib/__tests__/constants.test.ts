import { describe, it, expect } from 'vitest'
import { getStreakBonus, getStreakLabel, TIER_CONFIG, KID_COLORS } from '../constants'

describe('getStreakBonus', () => {
  it('returns 1.0 for streaks below 3', () => {
    expect(getStreakBonus(0)).toBe(1.0)
    expect(getStreakBonus(1)).toBe(1.0)
    expect(getStreakBonus(2)).toBe(1.0)
  })

  it('returns 1.25 for streaks 3–6', () => {
    expect(getStreakBonus(3)).toBe(1.25)
    expect(getStreakBonus(6)).toBe(1.25)
  })

  it('returns 1.5 for streaks 7–13', () => {
    expect(getStreakBonus(7)).toBe(1.5)
    expect(getStreakBonus(13)).toBe(1.5)
  })

  it('returns 2.0 for streaks 14+', () => {
    expect(getStreakBonus(14)).toBe(2.0)
    expect(getStreakBonus(100)).toBe(2.0)
  })
})

describe('getStreakLabel', () => {
  it('returns null for streaks below 3', () => {
    expect(getStreakLabel(0)).toBeNull()
    expect(getStreakLabel(2)).toBeNull()
  })

  it('returns +25% BONUS for streaks 3–6', () => {
    expect(getStreakLabel(3)).toBe('+25% BONUS')
    expect(getStreakLabel(6)).toBe('+25% BONUS')
  })

  it('returns 1.5× COINS! for streaks 7–13', () => {
    expect(getStreakLabel(7)).toBe('1.5× COINS!')
    expect(getStreakLabel(13)).toBe('1.5× COINS!')
  })

  it('returns 2× COINS! for streaks 14+', () => {
    expect(getStreakLabel(14)).toBe('2× COINS!')
    expect(getStreakLabel(30)).toBe('2× COINS!')
  })
})

describe('TIER_CONFIG', () => {
  const tiers = ['normal', 'heroic', 'legendary', 'epic'] as const

  it('has all four tiers', () => {
    tiers.forEach((tier) => {
      expect(TIER_CONFIG[tier]).toBeDefined()
    })
  })

  it('each tier has required fields', () => {
    tiers.forEach((tier) => {
      const cfg = TIER_CONFIG[tier]
      expect(cfg.label).toBeTruthy()
      expect(cfg.color).toMatch(/^(#|rgba)/)
      expect(cfg.bg).toMatch(/^rgba/)
      expect(cfg.border).toMatch(/^rgba/)
    })
  })

  it('only epic tier has a glow', () => {
    expect(TIER_CONFIG.normal.glow).toBeNull()
    expect(TIER_CONFIG.heroic.glow).toBeNull()
    expect(TIER_CONFIG.legendary.glow).toBeNull()
    expect(TIER_CONFIG.epic.glow).toBeTruthy()
  })
})

describe('KID_COLORS', () => {
  it('defines azure and mystic themes', () => {
    expect(KID_COLORS.azure).toBeDefined()
    expect(KID_COLORS.mystic).toBeDefined()
  })

  it('each theme has the required color fields', () => {
    const fields = ['primary', 'glow', 'bg', 'border', 'gradient'] as const
    ;(['azure', 'mystic'] as const).forEach((color) => {
      fields.forEach((field) => {
        expect(KID_COLORS[color][field]).toBeTruthy()
      })
    })
  })
})
