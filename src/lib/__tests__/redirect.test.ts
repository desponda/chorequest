import { describe, it, expect } from 'vitest'
import { safeRedirectPath } from '../redirect'

describe('safeRedirectPath', () => {
  it('allows safe relative paths', () => {
    expect(safeRedirectPath('/')).toBe('/')
    expect(safeRedirectPath('/parent')).toBe('/parent')
    expect(safeRedirectPath('/kid/abc-123')).toBe('/kid/abc-123')
    expect(safeRedirectPath('/join/some-token')).toBe('/join/some-token')
  })

  it('allows paths with query strings', () => {
    expect(safeRedirectPath('/parent?tab=quests')).toBe('/parent?tab=quests')
    expect(safeRedirectPath('/kid/abc?q=1&r=2')).toBe('/kid/abc?q=1&r=2')
  })

  it('allows paths with fragments', () => {
    expect(safeRedirectPath('/kid/abc#rewards')).toBe('/kid/abc#rewards')
  })

  it('blocks protocol-relative open redirects', () => {
    expect(safeRedirectPath('//evil.com')).toBe('/')
    expect(safeRedirectPath('//evil.com/path')).toBe('/')
  })

  it('blocks absolute URLs', () => {
    expect(safeRedirectPath('https://evil.com')).toBe('/')
    expect(safeRedirectPath('http://evil.com/steal')).toBe('/')
  })

  it('blocks javascript: and data: URIs', () => {
    expect(safeRedirectPath('javascript:alert(1)')).toBe('/')
    expect(safeRedirectPath('data:text/html,<h1>xss</h1>')).toBe('/')
  })

  it('blocks paths with leading whitespace', () => {
    expect(safeRedirectPath('  /parent')).toBe('/')
    expect(safeRedirectPath('\t/parent')).toBe('/')
  })

  it('falls back to / for null or undefined', () => {
    expect(safeRedirectPath(null)).toBe('/')
    expect(safeRedirectPath(undefined)).toBe('/')
    expect(safeRedirectPath('')).toBe('/')
  })
})
