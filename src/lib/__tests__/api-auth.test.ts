import { describe, it, expect } from 'vitest'
import { isAuthError, cors } from '../api-auth'

describe('isAuthError', () => {
  it('returns true for a Response object', () => {
    expect(isAuthError(new Response(null, { status: 401 }))).toBe(true)
  })

  it('returns false for an auth success object', () => {
    expect(isAuthError({ familyId: 'abc-123' })).toBe(false)
  })
})

describe('cors', () => {
  it('returns required CORS headers', () => {
    const headers = cors()
    expect(headers['Access-Control-Allow-Origin']).toBeTruthy()
    expect(headers['Access-Control-Allow-Methods']).toContain('GET')
    expect(headers['Access-Control-Allow-Methods']).toContain('POST')
    expect(headers['Access-Control-Allow-Headers']).toContain('Authorization')
  })

  it('uses CORS_ORIGIN env var when set', () => {
    const original = process.env.CORS_ORIGIN
    process.env.CORS_ORIGIN = 'https://example.com'
    expect(cors()['Access-Control-Allow-Origin']).toBe('https://example.com')
    process.env.CORS_ORIGIN = original
  })
})
