import { describe, it, expect } from 'vitest'
import { isValidPin } from '../utils'

describe('isValidPin', () => {
  it('accepts exactly 4 numeric digits', () => {
    expect(isValidPin('0000')).toBe(true)
    expect(isValidPin('1234')).toBe(true)
    expect(isValidPin('9999')).toBe(true)
  })

  it('rejects PINs that are too short', () => {
    expect(isValidPin('')).toBe(false)
    expect(isValidPin('1')).toBe(false)
    expect(isValidPin('123')).toBe(false)
  })

  it('rejects PINs that are too long', () => {
    expect(isValidPin('12345')).toBe(false)
    expect(isValidPin('00000')).toBe(false)
  })

  it('rejects PINs with non-numeric characters', () => {
    expect(isValidPin('abcd')).toBe(false)
    expect(isValidPin('12ab')).toBe(false)
    expect(isValidPin('12 4')).toBe(false)
    expect(isValidPin('12.4')).toBe(false)
    expect(isValidPin('12-4')).toBe(false)
  })

  it('rejects non-string values', () => {
    expect(isValidPin(1234)).toBe(false)
    expect(isValidPin(null)).toBe(false)
    expect(isValidPin(undefined)).toBe(false)
    expect(isValidPin([])).toBe(false)
    expect(isValidPin({ pin: '1234' })).toBe(false)
  })

  it('rejects PINs with leading/trailing whitespace', () => {
    expect(isValidPin(' 1234')).toBe(false)
    expect(isValidPin('1234 ')).toBe(false)
    expect(isValidPin(' 1234 ')).toBe(false)
  })
})
