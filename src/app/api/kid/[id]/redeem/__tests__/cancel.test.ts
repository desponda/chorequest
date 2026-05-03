import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(),
}))

import { createServiceClient } from '@/lib/supabase/service'
import { DELETE } from '../[redemptionId]/route'

function makeRequest(method = 'DELETE') {
  return new NextRequest('http://localhost/api/kid/kid-1/redeem/rdm-1', { method })
}

function makeParams(id = 'kid-1', redemptionId = 'rdm-1') {
  return { params: Promise.resolve({ id, redemptionId }) }
}

function makeSupabaseChain(overrides: {
  singleData?: { id: string } | null
  singleError?: object | null
  deleteError?: object | null
}) {
  const { singleData = null, singleError = null, deleteError = null } = overrides

  const deleteChain = {
    eq: vi.fn().mockReturnThis(),
    then: undefined as unknown,
  }
  Object.defineProperty(deleteChain, 'then', {
    get: () =>
      (resolve: (v: { error: typeof deleteError }) => void) =>
        resolve({ error: deleteError }),
  })

  const selectSingleChain = {
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: singleData, error: singleError }),
  }

  const mockFrom = vi.fn((table: string) => {
    if (table === 'redemptions') {
      return {
        select: vi.fn().mockReturnValue(selectSingleChain),
        delete: vi.fn().mockReturnValue(deleteChain),
      }
    }
    return {}
  })

  return { from: mockFrom }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('DELETE /api/kid/[id]/redeem/[redemptionId]', () => {
  it('returns 404 when redemption not found (already approved or not belonging to kid)', async () => {
    vi.mocked(createServiceClient).mockReturnValue(
      makeSupabaseChain({ singleData: null }) as ReturnType<typeof createServiceClient>
    )

    const res = await DELETE(makeRequest(), makeParams())
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error).toMatch(/not found|already approved/i)
  })

  it('deletes and returns 200 when redemption is pending and belongs to kid', async () => {
    vi.mocked(createServiceClient).mockReturnValue(
      makeSupabaseChain({ singleData: { id: 'rdm-1' }, deleteError: null }) as ReturnType<
        typeof createServiceClient
      >
    )

    const res = await DELETE(makeRequest(), makeParams())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
  })

  it('returns 500 when the database delete fails', async () => {
    vi.mocked(createServiceClient).mockReturnValue(
      makeSupabaseChain({
        singleData: { id: 'rdm-1' },
        deleteError: { message: 'DB error' },
      }) as ReturnType<typeof createServiceClient>
    )

    const res = await DELETE(makeRequest(), makeParams())
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.error).toBeTruthy()
  })

  it('is idempotent: re-cancelling an already-cancelled redemption returns 404', async () => {
    // After a successful cancel, the row is gone → second DELETE finds nothing
    vi.mocked(createServiceClient).mockReturnValue(
      makeSupabaseChain({ singleData: null }) as ReturnType<typeof createServiceClient>
    )

    const res = await DELETE(makeRequest(), makeParams('kid-1', 'rdm-already-gone'))
    expect(res.status).toBe(404)
  })
})
