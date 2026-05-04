import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(),
}))

import { createServiceClient } from '@/lib/supabase/service'
import { DELETE } from '../[redemptionId]/route'

function makeRequest() {
  return new NextRequest('http://localhost/api/kid/kid-1/redeem/rdm-1', { method: 'DELETE' })
}

function makeParams(id = 'kid-1', redemptionId = 'rdm-1') {
  return { params: Promise.resolve({ id, redemptionId }) }
}

function makeClient(opts: {
  singleData?: { id: string } | null
  deleteError?: { message: string } | null
}) {
  const { singleData = null, deleteError = null } = opts

  const deleteChain = { eq: vi.fn().mockReturnThis(), then: undefined as unknown }
  Object.defineProperty(deleteChain, 'then', {
    get: () => (resolve: (v: { error: typeof deleteError }) => void) => resolve({ error: deleteError }),
  })

  const selectChain = {
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: singleData, error: singleData ? null : { message: 'Not found' } }),
  }

  return {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnValue(selectChain),
      delete: vi.fn().mockReturnValue(deleteChain),
    })),
  }
}

beforeEach(() => { vi.clearAllMocks() })

describe('DELETE /api/kid/[id]/redeem/[redemptionId]', () => {
  it('returns 404 when redemption not found or already approved', async () => {
    vi.mocked(createServiceClient).mockReturnValue(
      makeClient({ singleData: null }) as unknown as ReturnType<typeof createServiceClient>
    )
    const res = await DELETE(makeRequest(), makeParams())
    expect(res.status).toBe(404)
    expect((await res.json()).error).toMatch(/not found|already approved/i)
  })

  it('returns 200 when redemption is pending and belongs to kid', async () => {
    vi.mocked(createServiceClient).mockReturnValue(
      makeClient({ singleData: { id: 'rdm-1' } }) as unknown as ReturnType<typeof createServiceClient>
    )
    const res = await DELETE(makeRequest(), makeParams())
    expect(res.status).toBe(200)
    expect((await res.json()).success).toBe(true)
  })

  it('returns 500 when the database delete fails', async () => {
    vi.mocked(createServiceClient).mockReturnValue(
      makeClient({ singleData: { id: 'rdm-1' }, deleteError: { message: 'DB error' } }) as unknown as ReturnType<typeof createServiceClient>
    )
    const res = await DELETE(makeRequest(), makeParams())
    expect(res.status).toBe(500)
  })

  it('is idempotent: re-cancelling an already-cancelled redemption returns 404', async () => {
    vi.mocked(createServiceClient).mockReturnValue(
      makeClient({ singleData: null }) as unknown as ReturnType<typeof createServiceClient>
    )
    const res = await DELETE(makeRequest(), makeParams('kid-1', 'already-gone'))
    expect(res.status).toBe(404)
  })
})
