import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { createKidSessionToken, KID_SESSION_COOKIE } from '@/lib/kid-session'

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(),
}))

import { createServiceClient } from '@/lib/supabase/service'
import { POST } from '../route'

function makeRequest(body: object) {
  return new NextRequest('http://localhost/api/kid/kid-1/redeem', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
      Cookie: `${KID_SESSION_COOKIE}=${createKidSessionToken('kid-1')}`,
    },
  })
}

function makeParams(id = 'kid-1') {
  return { params: Promise.resolve({ id }) }
}

type Opts = {
  kid?: { id: string; coins: number; family_id?: string } | null
  reward?: { id: string; cost: number; family_id?: string } | null
  pendingRedemptions?: Array<{ cost_charged?: number | null; reward: { cost: number } | null }>
  insertError?: object | null
  insertSpy?: ReturnType<typeof vi.fn>
}

function makeClient(opts: Opts) {
  const {
    kid = { id: 'kid-1', coins: 100 },
    reward = { id: 'reward-1', cost: 20 },
    pendingRedemptions = [],
    insertError = null,
    insertSpy = vi.fn().mockResolvedValue({ error: insertError }),
  } = opts

  // The route calls from('redemptions') twice: first a select for pending, then an insert.
  const redemptionCalls = [
    {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      then: (resolve: (v: { data: typeof pendingRedemptions; error: null }) => void) =>
        resolve({ data: pendingRedemptions, error: null }),
    },
    { insert: insertSpy },
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

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('KID_SESSION_SECRET', 'test-secret')
})

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

  it('reserves each pending redemption at its request-time price', async () => {
    // The catalog price later dropped to 1, but this request reserved 25 coins.
    vi.mocked(createServiceClient).mockReturnValue(
      makeClient({
        kid: { id: 'kid-1', coins: 30 },
        reward: { id: 'r', cost: 10 },
        pendingRedemptions: [{ cost_charged: 25, reward: { cost: 1 } }],
      }) as unknown as ReturnType<typeof createServiceClient>
    )
    const res = await POST(makeRequest({ reward_id: 'r' }), makeParams())
    expect(res.status).toBe(400)
  })

  it('snapshots the current reward price on the new request', async () => {
    const insertSpy = vi.fn().mockResolvedValue({ error: null })
    vi.mocked(createServiceClient).mockReturnValue(
      makeClient({ reward: { id: 'r', cost: 15 }, insertSpy }) as unknown as ReturnType<typeof createServiceClient>
    )
    const res = await POST(makeRequest({ reward_id: 'r' }), makeParams())
    expect(res.status).toBe(200)
    expect(insertSpy).toHaveBeenCalledWith(expect.objectContaining({ cost_charged: 15 }))
  })

  it('returns 404 when the reward belongs to another family', async () => {
    vi.mocked(createServiceClient).mockReturnValue(
      makeClient({
        kid: { id: 'kid-1', coins: 100, family_id: 'family-1' },
        reward: { id: 'r', cost: 10, family_id: 'family-2' },
      }) as unknown as ReturnType<typeof createServiceClient>
    )
    const res = await POST(makeRequest({ reward_id: 'r' }), makeParams())
    expect(res.status).toBe(404)
  })

  it('rejects zero or negative reward costs', async () => {
    vi.mocked(createServiceClient).mockReturnValue(
      makeClient({ reward: { id: 'r', cost: 0 } }) as unknown as ReturnType<typeof createServiceClient>
    )
    const res = await POST(makeRequest({ reward_id: 'r' }), makeParams())
    expect(res.status).toBe(422)
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
