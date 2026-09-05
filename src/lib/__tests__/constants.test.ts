import { describe, it, expect } from 'vitest'
import { getStreakLabel, getLockDurationMs, TIER_CONFIG, KID_COLORS } from '../constants'

describe('getStreakLabel', () => {
  it('always returns null (bonus labels removed)', () => {
    expect(getStreakLabel(0)).toBeNull()
    expect(getStreakLabel(3)).toBeNull()
    expect(getStreakLabel(7)).toBeNull()
    expect(getStreakLabel(14)).toBeNull()
    expect(getStreakLabel(30)).toBeNull()
  })
})

describe('TIER_CONFIG', () => {
  const tiers = ['normal', 'rare', 'epic', 'legendary'] as const

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
      expect(cfg.bg).toBeTruthy()
      expect(cfg.border).toMatch(/^rgba/)
    })
  })

  it('non-normal tiers have glows; normal does not', () => {
    expect(TIER_CONFIG.normal.glow).toBeNull()
    expect(TIER_CONFIG.rare.glow).toBeTruthy()
    expect(TIER_CONFIG.legendary.glow).toBeTruthy()
    expect(TIER_CONFIG.epic.glow).toBeTruthy()
  })
})

describe('getLockDurationMs', () => {
  it('returns 30 seconds (30_000ms) for attempts 5–7', () => {
    expect(getLockDurationMs(5)).toBe(30_000)
    expect(getLockDurationMs(6)).toBe(30_000)
    expect(getLockDurationMs(7)).toBe(30_000)
  })

  it('returns 5 minutes (300_000ms) for attempts 8+', () => {
    expect(getLockDurationMs(8)).toBe(300_000)
    expect(getLockDurationMs(9)).toBe(300_000)
    expect(getLockDurationMs(100)).toBe(300_000)
  })

  it('treats attempt counts below 5 as short lock (edge: called with any value)', () => {
    // Function is called only when attempts >= 5, but should still be safe
    expect(getLockDurationMs(1)).toBe(30_000)
    expect(getLockDurationMs(0)).toBe(30_000)
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
