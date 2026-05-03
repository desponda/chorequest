import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { isAuthError, cors } from '../api-auth'

describe('isAuthError', () => {
  it('returns true for a Response object', () => {
    expect(isAuthError(new Response(null, { status: 401 }))).toBe(true)
  })

  it('returns true regardless of HTTP status code', () => {
    expect(isAuthError(new Response(null, { status: 200 }))).toBe(true)
    expect(isAuthError(new Response(null, { status: 500 }))).toBe(true)
  })

  it('returns false for an auth success object', () => {
    expect(isAuthError({ familyId: 'abc-123' })).toBe(false)
  })

  it('returns false for non-Response values', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const check = (v: any) => isAuthError(v)
    expect(check(null)).toBe(false)
    expect(check(undefined)).toBe(false)
    expect(check('error')).toBe(false)
    expect(check(401)).toBe(false)
  })
})

describe('cors', () => {
  let savedCorsOrigin: string | undefined

  beforeEach(() => {
    savedCorsOrigin = process.env.CORS_ORIGIN
    vi.unstubAllEnvs()
  })

  afterEach(() => {
    process.env.CORS_ORIGIN = savedCorsOrigin
    vi.unstubAllEnvs()
  })

  it('returns required CORS headers', () => {
    const headers = cors()
    expect(headers['Access-Control-Allow-Origin']).toBeTruthy()
    expect(headers['Access-Control-Allow-Methods']).toContain('GET')
    expect(headers['Access-Control-Allow-Methods']).toContain('POST')
    expect(headers['Access-Control-Allow-Methods']).toContain('DELETE')
    expect(headers['Access-Control-Allow-Headers']).toContain('Authorization')
    expect(headers['Access-Control-Allow-Headers']).toContain('Content-Type')
  })

  it('uses CORS_ORIGIN env var when set', () => {
    process.env.CORS_ORIGIN = 'https://example.com'
    expect(cors()['Access-Control-Allow-Origin']).toBe('https://example.com')
  })

  it('returns * in non-production when CORS_ORIGIN is unset', () => {
    delete process.env.CORS_ORIGIN
    vi.stubEnv('NODE_ENV', 'test')
    expect(cors()['Access-Control-Allow-Origin']).toBe('*')
  })

  it('returns production URL in production when CORS_ORIGIN is unset', () => {
    delete process.env.CORS_ORIGIN
    vi.stubEnv('NODE_ENV', 'production')
    expect(cors()['Access-Control-Allow-Origin']).toBe('https://chorequest.dresponda.com')
  })
})
