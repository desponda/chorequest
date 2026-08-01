import { describe, expect, it } from 'vitest'
import { boundedInteger, nonEmptyString } from '../validation'

describe('boundedInteger', () => {
  it('accepts integers and integer strings inside the range', () => {
    expect(boundedInteger(10, { min: 0, max: 100 })).toBe(10)
    expect(boundedInteger('10', { min: 0, max: 100 })).toBe(10)
  })

  it('rejects negative, fractional, non-numeric, empty, and out-of-range values', () => {
    expect(boundedInteger(-1, { min: 0, max: 100 })).toBeNull()
    expect(boundedInteger(1.5, { min: 0, max: 100 })).toBeNull()
    expect(boundedInteger('nope', { min: 0, max: 100 })).toBeNull()
    expect(boundedInteger('', { min: 0, max: 100 })).toBeNull()
    expect(boundedInteger(101, { min: 0, max: 100 })).toBeNull()
  })

  it('uses a valid default only when the field is omitted', () => {
    expect(boundedInteger(undefined, { defaultValue: 10, min: 0, max: 100 })).toBe(10)
    expect(boundedInteger(null, { defaultValue: 10, min: 0, max: 100 })).toBeNull()
  })
})

describe('nonEmptyString', () => {
  it('trims content and rejects blank or non-string values', () => {
    expect(nonEmptyString('  quest  ')).toBe('quest')
    expect(nonEmptyString('   ')).toBeNull()
    expect(nonEmptyString(123)).toBeNull()
  })
})
