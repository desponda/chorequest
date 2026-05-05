import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(),
}))

import { createServiceClient } from '@/lib/supabase/service'
import { DELETE } from '../[completionId]/route'

function makeRequest() {
  return new NextRequest('http://localhost/api/kid/kid-1/complete/comp-1', { method: 'DELETE' })
}

function makeParams(id = 'kid-1', completionId = 'comp-1') {
  return { params: Promise.resolve({ id, completionId }) }
}

type Opts = {
  completion?: { id: string } | null
  deleteError?: { message: string } | null
}

function makeClient(opts: Opts = {}) {
  const { completion = { id: 'comp-1' }, deleteError = null } = opts

  const deleteChain = { eq: vi.fn().mockReturnThis(), then: undefined as unknown }
  Object.defineProperty(deleteChain, 'then', {
    get: () => (resolve: (v: { error: typeof deleteError }) => void) => resolve({ error: deleteError }),
  })

  return {
    from: vi.fn((table: string) => {
      if (table === 'completions') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: completion, error: completion ? null : { message: 'Not found' } }),
          delete: vi.fn().mockReturnValue(deleteChain),
        }
      }
      return {}
    }),
  }
}

beforeEach(() => { vi.clearAllMocks() })

describe('DELETE /api/kid/[id]/complete/[completionId]', () => {
  it('returns 404 when completion is not found', async () => {
    vi.mocked(createServiceClient).mockReturnValue(
      makeClient({ completion: null }) as unknown as ReturnType<typeof createServiceClient>
    )
    const res = await DELETE(makeRequest(), makeParams())
    expect(res.status).toBe(404)
    expect((await res.json()).error).toMatch(/not found|already reviewed/i)
  })

  it('returns 404 when completion belongs to a different kid', async () => {
    // the route queries eq('kid_id', id) — if it doesn't match the DB returns no row
    vi.mocked(createServiceClient).mockReturnValue(
      makeClient({ completion: null }) as unknown as ReturnType<typeof createServiceClient>
    )
    const res = await DELETE(makeRequest(), makeParams('kid-2', 'comp-1'))
    expect(res.status).toBe(404)
  })

  it('returns 404 when completion is not in pending status', async () => {
    // route filters eq('status', 'pending') — approved/rejected returns null
    vi.mocked(createServiceClient).mockReturnValue(
      makeClient({ completion: null }) as unknown as ReturnType<typeof createServiceClient>
    )
    const res = await DELETE(makeRequest(), makeParams())
    expect(res.status).toBe(404)
  })

  it('returns 200 and success:true when pending completion is deleted', async () => {
    vi.mocked(createServiceClient).mockReturnValue(
      makeClient({ completion: { id: 'comp-1' } }) as unknown as ReturnType<typeof createServiceClient>
    )
    const res = await DELETE(makeRequest(), makeParams())
    expect(res.status).toBe(200)
    expect((await res.json()).success).toBe(true)
  })

  it('returns 500 when the database delete fails', async () => {
    vi.mocked(createServiceClient).mockReturnValue(
      makeClient({ completion: { id: 'comp-1' }, deleteError: { message: 'DB error' } }) as unknown as ReturnType<typeof createServiceClient>
    )
    const res = await DELETE(makeRequest(), makeParams())
    expect(res.status).toBe(500)
    expect((await res.json()).error).toBe('DB error')
  })
})
