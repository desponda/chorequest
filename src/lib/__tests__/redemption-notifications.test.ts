import { describe, expect, it } from 'vitest'
import { classifyRedemptionChanges } from '../redemption-notifications'

describe('classifyRedemptionChanges', () => {
  it('identifies a pending request that was approved and disappeared', () => {
    expect(classifyRedemptionChanges(['r1'], [])).toEqual({
      approvedIds: ['r1'],
      deniedIds: [],
      pendingIds: [],
    })
  })

  it('reports a denial separately instead of treating it as an approval', () => {
    expect(classifyRedemptionChanges(['r1'], [{ id: 'r1', status: 'denied' }])).toEqual({
      approvedIds: [],
      deniedIds: ['r1'],
      pendingIds: [],
    })
  })

  it('does not announce a locally cancelled request as approved', () => {
    expect(classifyRedemptionChanges(['r1'], [], new Set(['r1']))).toEqual({
      approvedIds: [],
      deniedIds: [],
      pendingIds: [],
    })
  })

  it('keeps tracking requests that are still pending', () => {
    expect(classifyRedemptionChanges(['r1'], [{ id: 'r1', status: 'pending' }])).toEqual({
      approvedIds: [],
      deniedIds: [],
      pendingIds: ['r1'],
    })
  })
})
