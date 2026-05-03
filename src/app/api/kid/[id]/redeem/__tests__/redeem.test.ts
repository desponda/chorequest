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

type MockSupabaseOptions = {
  kid?: { id: string; coins: number } | null
  reward?: { id: string; cost: number } | null
  pendingRedemptions?: Array<{ reward: { cost: number } | null }>
  insertError?: object | null
}

function makeSupabase(opts: MockSupabaseOptions) {
  const {
    kid = { id: 'kid-1', coins: 100 },
    reward = { id: 'reward-1', cost: 20 },
    pendingRedemptions = [],
    insertError = null,
  } = opts

  const mockFrom = vi.fn((table: string) => {
    if (table === 'kids') {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: kid, error: kid ? null : { message: 'Not found' } }),
      }
    }
    if (table === 'rewards') {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: reward, error: reward ? null : { message: 'Not found' } }),
      }
    }
    if (table === 'redemptions') {
      // The route calls .from('redemptions') twice: once for pending select, once for insert
      let callCount = 0
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        insert: vi.fn().mockResolvedValue({ error: insertError }),
        then: (resolve: (v: { data: typeof pendingRedemptions }) => void) =>
          resolve({ data: pendingRedemptions }),
      }
    }
    return {}
  })

  return { from: mockFrom }
}

// The route uses Promise.all for kids+rewards, then a separate pending fetch, then insert.
// We need two different from('redemptions') behaviors: first returns pending list, second is insert.
function makeSupabaseSequential(opts: MockSupabaseOptions) {
  const {
    kid = { id: 'kid-1', coins: 100 },
    reward = { id: 'reward-1', cost: 20 },
    pendingRedemptions = [],
    insertError = null,
  } = opts

  const redemptionsCallStack = [
    // First call: select pending
    {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      // awaitable via resolved promise
      then: (resolve: (v: { data: typeof pendingRedemptions; error: null }) => void) =>
        resolve({ data: pendingRedemptions, error: null }),
    },
    // Second call: insert
    {
      insert: vi.fn().mockResolvedValue({ error: insertError }),
    },
  ]
  let redemptionsIdx = 0

  const mockFrom = vi.fn((table: string) => {
    if (table === 'kids') {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: kid }),
      }
    }
    if (table === 'rewards') {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: reward }),
      }
    }
    if (table === 'redemptions') {
      return redemptionsCallStack[redemptionsIdx++]
    }
    return {}
  })

  return { from: mockFrom }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/kid/[id]/redeem — available coins guard', () => {
  it('returns 400 when kid has fewer available coins than reward cost after pending deductions', async () => {
    // kid has 30 coins, 20 already locked in pending redemption → only 10 available, reward costs 15
    vi.mocked(createServiceClient).mockReturnValue(
      makeSupabaseSequential({
        kid: { id: 'kid-1', coins: 30 },
        reward: { id: 'reward-1', cost: 15 },
        pendingRedemptions: [{ reward: { cost: 20 } }],
      }) as ReturnType<typeof createServiceClient>
    )

    const res = await POST(makeRequest({ reward_id: 'reward-1' }), makeParams())
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toMatch(/insufficient/i)
  })

  it('returns 200 when kid has exactly enough available coins', async () => {
    // kid has 35 coins, 20 locked → 15 available, reward costs exactly 15
    vi.mocked(createServiceClient).mockReturnValue(
      makeSupabaseSequential({
        kid: { id: 'kid-1', coins: 35 },
        reward: { id: 'reward-1', cost: 15 },
        pendingRedemptions: [{ reward: { cost: 20 } }],
        insertError: null,
      }) as ReturnType<typeof createServiceClient>
    )

    const res = await POST(makeRequest({ reward_id: 'reward-1' }), makeParams())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
  })

  it('returns 400 even when raw coin balance looks sufficient but pending locks it up', async () => {
    // kid has 50 coins total but 45 are locked in pending → only 5 available, reward costs 10
    vi.mocked(createServiceClient).mockReturnValue(
      makeSupabaseSequential({
        kid: { id: 'kid-1', coins: 50 },
        reward: { id: 'reward-1', cost: 10 },
        pendingRedemptions: [{ reward: { cost: 30 } }, { reward: { cost: 15 } }],
      }) as ReturnType<typeof createServiceClient>
    )

    const res = await POST(makeRequest({ reward_id: 'reward-1' }), makeParams())
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toMatch(/insufficient/i)
  })

  it('returns 400 when request body is invalid', async () => {
    vi.mocked(createServiceClient).mockReturnValue(
      makeSupabaseSequential({}) as ReturnType<typeof createServiceClient>
    )

    const res = await POST(makeRequest({}), makeParams())
    expect(res.status).toBe(400)
  })

  it('returns 404 when kid does not exist', async () => {
    vi.mocked(createServiceClient).mockReturnValue(
      makeSupabaseSequential({ kid: null }) as ReturnType<typeof createServiceClient>
    )

    const res = await POST(makeRequest({ reward_id: 'reward-1' }), makeParams())
    expect(res.status).toBe(404)
  })

  it('returns 404 when reward does not exist or is unavailable', async () => {
    vi.mocked(createServiceClient).mockReturnValue(
      makeSupabaseSequential({ reward: null }) as ReturnType<typeof createServiceClient>
    )

    const res = await POST(makeRequest({ reward_id: 'nonexistent' }), makeParams())
    expect(res.status).toBe(404)
  })

  it('handles pending redemptions with null reward join gracefully', async () => {
    // A redemption row with a broken reward FK should count as 0 cost (not crash)
    vi.mocked(createServiceClient).mockReturnValue(
      makeSupabaseSequential({
        kid: { id: 'kid-1', coins: 50 },
        reward: { id: 'reward-1', cost: 10 },
        pendingRedemptions: [{ reward: null }, { reward: { cost: 5 } }],
        insertError: null,
      }) as ReturnType<typeof createServiceClient>
    )

    const res = await POST(makeRequest({ reward_id: 'reward-1' }), makeParams())
    const body = await res.json()

    // 50 coins - 5 locked - 0 (null reward counts 0) = 45 available, reward costs 10 → ok
    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
  })
})
