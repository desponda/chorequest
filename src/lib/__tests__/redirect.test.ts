import { describe, it, expect } from 'vitest'
import { safeRedirectPath } from '../redirect'

describe('safeRedirectPath', () => {
  it('allows safe relative paths', () => {
    expect(safeRedirectPath('/')).toBe('/')
    expect(safeRedirectPath('/parent')).toBe('/parent')
    expect(safeRedirectPath('/kid/abc-123')).toBe('/kid/abc-123')
    expect(safeRedirectPath('/join/some-token')).toBe('/join/some-token')
  })

  it('blocks protocol-relative open redirects', () => {
    expect(safeRedirectPath('//evil.com')).toBe('/')
    expect(safeRedirectPath('//evil.com/path')).toBe('/')
  })

  it('blocks absolute URLs', () => {
    expect(safeRedirectPath('https://evil.com')).toBe('/')
    expect(safeRedirectPath('http://evil.com/steal')).toBe('/')
  })

  it('falls back to / for null or undefined', () => {
    expect(safeRedirectPath(null)).toBe('/')
    expect(safeRedirectPath(undefined)).toBe('/')
    expect(safeRedirectPath('')).toBe('/')
  })
})
