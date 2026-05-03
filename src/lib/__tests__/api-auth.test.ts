import { describe, it, expect, beforeEach, afterEach } from 'vitest'
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
    expect(isAuthError(null)).toBe(false)
    expect(isAuthError(undefined)).toBe(false)
    expect(isAuthError('error')).toBe(false)
    expect(isAuthError(401)).toBe(false)
  })
})

describe('cors', () => {
  let originalCorsOrigin: string | undefined
  let originalNodeEnv: string | undefined

  beforeEach(() => {
    originalCorsOrigin = process.env.CORS_ORIGIN
    originalNodeEnv = process.env.NODE_ENV
  })

  afterEach(() => {
    process.env.CORS_ORIGIN = originalCorsOrigin
    process.env.NODE_ENV = originalNodeEnv
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
    process.env.NODE_ENV = 'test'
    expect(cors()['Access-Control-Allow-Origin']).toBe('*')
  })

  it('returns production URL in production when CORS_ORIGIN is unset', () => {
    delete process.env.CORS_ORIGIN
    process.env.NODE_ENV = 'production'
    expect(cors()['Access-Control-Allow-Origin']).toBe('https://chorequest.dresponda.com')
  })
})
