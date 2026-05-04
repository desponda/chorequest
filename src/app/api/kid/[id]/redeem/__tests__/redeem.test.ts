import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(),
}))

import { createServiceClient } from '@/lib/supabase/service'
import { POST } from '../route'

function makeRequest(body: object) {
  return new NextRequest('http://localhost/api/kid/kid-1/redeem', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

function makeParams(id = 'kid-1') {
  return { params: Promise.resolve({ id }) }
}

type Opts = {
  kid?: { id: string; coins: number } | null
  reward?: { id: string; cost: number } | null
  pendingRedemptions?: Array<{ reward: { cost: number } | null }>
  insertError?: object | null
}

function makeClient(opts: Opts) {
  const {
    kid = { id: 'kid-1', coins: 100 },
    reward = { id: 'reward-1', cost: 20 },
    pendingRedemptions = [],
    insertError = null,
  } = opts

  // The route calls from('redemptions') twice: first a select for pending, then an insert.
  const redemptionCalls = [
    {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      then: (resolve: (v: { data: typeof pendingRedemptions; error: null }) => void) =>
        resolve({ data: pendingRedemptions, error: null }),
    },
    { insert: vi.fn().mockResolvedValue({ error: insertError }) },
  ]
  let redemptionIdx = 0

  return {
    from: vi.fn((table: string) => {
      if (table === 'kids') return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: kid }) }
      if (table === 'rewards') return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: reward }) }
      if (table === 'redemptions') return redemptionCalls[redemptionIdx++]
      return {}
    }),
  }
}

beforeEach(() => { vi.clearAllMocks() })

describe('POST /api/kid/[id]/redeem — available coins guard', () => {
  it('returns 400 when pending deductions leave insufficient coins', async () => {
    // 30 coins, 20 locked → 10 available, reward costs 15
    vi.mocked(createServiceClient).mockReturnValue(
      makeClient({ kid: { id: 'kid-1', coins: 30 }, reward: { id: 'r', cost: 15 }, pendingRedemptions: [{ reward: { cost: 20 } }] }) as unknown as ReturnType<typeof createServiceClient>
    )
    const res = await POST(makeRequest({ reward_id: 'r' }), makeParams())
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/insufficient/i)
  })

  it('returns 200 when kid has exactly enough available coins', async () => {
    // 35 coins, 20 locked → 15 available, reward costs 15
    vi.mocked(createServiceClient).mockReturnValue(
      makeClient({ kid: { id: 'kid-1', coins: 35 }, reward: { id: 'r', cost: 15 }, pendingRedemptions: [{ reward: { cost: 20 } }] }) as unknown as ReturnType<typeof createServiceClient>
    )
    const res = await POST(makeRequest({ reward_id: 'r' }), makeParams())
    expect(res.status).toBe(200)
    expect((await res.json()).success).toBe(true)
  })

  it('returns 400 when multiple pending redemptions lock up coins', async () => {
    // 50 coins, 45 locked → 5 available, reward costs 10
    vi.mocked(createServiceClient).mockReturnValue(
      makeClient({ kid: { id: 'kid-1', coins: 50 }, reward: { id: 'r', cost: 10 }, pendingRedemptions: [{ reward: { cost: 30 } }, { reward: { cost: 15 } }] }) as unknown as ReturnType<typeof createServiceClient>
    )
    const res = await POST(makeRequest({ reward_id: 'r' }), makeParams())
    expect(res.status).toBe(400)
  })

  it('returns 400 on invalid request body', async () => {
    vi.mocked(createServiceClient).mockReturnValue(
      makeClient({}) as unknown as ReturnType<typeof createServiceClient>
    )
    const res = await POST(makeRequest({}), makeParams())
    expect(res.status).toBe(400)
  })

  it('returns 404 when kid does not exist', async () => {
    vi.mocked(createServiceClient).mockReturnValue(
      makeClient({ kid: null }) as unknown as ReturnType<typeof createServiceClient>
    )
    const res = await POST(makeRequest({ reward_id: 'r' }), makeParams())
    expect(res.status).toBe(404)
  })

  it('returns 404 when reward does not exist', async () => {
    vi.mocked(createServiceClient).mockReturnValue(
      makeClient({ reward: null }) as unknown as ReturnType<typeof createServiceClient>
    )
    const res = await POST(makeRequest({ reward_id: 'nonexistent' }), makeParams())
    expect(res.status).toBe(404)
  })

  it('treats pending redemptions with null reward join as 0 cost', async () => {
    // null reward row should not crash, counts as 0
    vi.mocked(createServiceClient).mockReturnValue(
      makeClient({ kid: { id: 'kid-1', coins: 50 }, reward: { id: 'r', cost: 10 }, pendingRedemptions: [{ reward: null }, { reward: { cost: 5 } }] }) as unknown as ReturnType<typeof createServiceClient>
    )
    const res = await POST(makeRequest({ reward_id: 'r' }), makeParams())
    expect(res.status).toBe(200)
  })
})
