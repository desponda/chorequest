import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { createKidSessionToken, KID_SESSION_COOKIE } from '@/lib/kid-session'

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(),
}))

import { createServiceClient } from '@/lib/supabase/service'
import { DELETE } from '../[redemptionId]/route'

function makeRequest() {
  return new NextRequest('http://localhost/api/kid/kid-1/redeem/rdm-1', {
    method: 'DELETE',
    headers: { Cookie: `${KID_SESSION_COOKIE}=${createKidSessionToken('kid-1')}` },
  })
}

function makeParams(id = 'kid-1', redemptionId = 'rdm-1') {
  return { params: Promise.resolve({ id, redemptionId }) }
}

function makeClient(opts: {
  deletedData?: { id: string } | null
  deleteError?: { message: string } | null
}) {
  const { deletedData = null, deleteError = null } = opts

  const deleteChain = {
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: deletedData, error: deleteError }),
  }

  return {
    from: vi.fn(() => deleteChain),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('KID_SESSION_SECRET', 'test-secret')
})

describe('DELETE /api/kid/[id]/redeem/[redemptionId]', () => {
  it('returns 409 when redemption not found or already approved', async () => {
    vi.mocked(createServiceClient).mockReturnValue(
      makeClient({ deletedData: null }) as unknown as ReturnType<typeof createServiceClient>
    )
    const res = await DELETE(makeRequest(), makeParams())
    expect(res.status).toBe(409)
    expect((await res.json()).error).toMatch(/not found|already approved/i)
  })

  it('returns 200 when redemption is pending and belongs to kid', async () => {
    vi.mocked(createServiceClient).mockReturnValue(
      makeClient({ deletedData: { id: 'rdm-1' } }) as unknown as ReturnType<typeof createServiceClient>
    )
    const res = await DELETE(makeRequest(), makeParams())
    expect(res.status).toBe(200)
    expect((await res.json()).success).toBe(true)
  })

  it('returns 500 when the database delete fails', async () => {
    vi.mocked(createServiceClient).mockReturnValue(
      makeClient({ deletedData: null, deleteError: { message: 'DB error' } }) as unknown as ReturnType<typeof createServiceClient>
    )
    const res = await DELETE(makeRequest(), makeParams())
    expect(res.status).toBe(500)
  })

  it('is idempotent: re-cancelling an already-cancelled redemption returns 409', async () => {
    vi.mocked(createServiceClient).mockReturnValue(
      makeClient({ deletedData: null }) as unknown as ReturnType<typeof createServiceClient>
    )
    const res = await DELETE(makeRequest(), makeParams('kid-1', 'already-gone'))
    expect(res.status).toBe(409)
  })
})
