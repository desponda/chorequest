import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createKidSessionToken, verifyKidSessionToken } from '../kid-session'

describe('kid session tokens', () => {
  beforeEach(() => vi.stubEnv('KID_SESSION_SECRET', 'test-secret'))
  afterEach(() => vi.unstubAllEnvs())

  it('accepts a valid token for the kid that verified their PIN', () => {
    const now = Date.UTC(2026, 4, 5)
    const token = createKidSessionToken('kid-1', now)
    expect(verifyKidSessionToken(token, 'kid-1', now + 1_000)).toBe(true)
  })

  it('rejects another kid, tampering, and expired tokens', () => {
    const now = Date.UTC(2026, 4, 5)
    const token = createKidSessionToken('kid-1', now)
    expect(verifyKidSessionToken(token, 'kid-2', now)).toBe(false)
    expect(verifyKidSessionToken(`${token}x`, 'kid-1', now)).toBe(false)
    expect(verifyKidSessionToken(token, 'kid-1', now + 13 * 60 * 60 * 1_000)).toBe(false)
  })
})
