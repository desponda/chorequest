import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(),
}))

import { createServiceClient } from '@/lib/supabase/service'
import { buildLedger } from '@/lib/ledger'

type QueryResult = { data: unknown[] | null; error: { message: string } | null }

function query(result: QueryResult) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    then: (resolve: (value: QueryResult) => unknown) => resolve(result),
  }
  return chain
}

function makeClient(results: Record<string, QueryResult>) {
  return {
    from: vi.fn((table: string) => query(results[table])),
  }
}

beforeEach(() => vi.clearAllMocks())

describe('buildLedger', () => {
  it('returns stored resulting balances without reconstructing them', async () => {
    vi.mocked(createServiceClient).mockReturnValue(makeClient({
      coin_transactions: {
        data: [{
          id: 'tx-1',
          kind: 'quest_reward',
          description: 'Make the bed',
          icon: '🛏️',
          amount: 10,
          balance_after: 45,
          occurred_at: '2026-08-01T12:00:00.000Z',
          is_estimated: false,
        }],
        error: null,
      },
      completions: { data: [], error: null },
      redemptions: { data: [], error: null },
    }) as unknown as ReturnType<typeof createServiceClient>)

    const result = await buildLedger('kid-1')

    expect(result.ledger).toEqual([expect.objectContaining({
      id: 'tx-1',
      amount: 10,
      balance_after: 45,
      is_estimated: false,
    })])
  })

  it('shows pending quest credits and reward debits separately from posted activity', async () => {
    vi.mocked(createServiceClient).mockReturnValue(makeClient({
      coin_transactions: { data: [], error: null },
      completions: {
        data: [{
          id: 'completion-1',
          completed_at: '2026-08-01T10:00:00.000Z',
          coins_requested: 15,
          quest: { title: 'Tidy room', icon: '🧹', coins: 99 },
        }],
        error: null,
      },
      redemptions: {
        data: [{
          id: 'redemption-1',
          redeemed_at: '2026-08-01T11:00:00.000Z',
          cost_charged: 20,
          reward: { title: 'Screen time', icon: '🎮', cost: 5 },
        }],
        error: null,
      },
    }) as unknown as ReturnType<typeof createServiceClient>)

    const result = await buildLedger('kid-1')

    expect(result.ledger).toEqual([])
    expect(result.pending).toEqual([
      expect.objectContaining({ kind: 'reward_pending', amount: -20, description: 'Screen time' }),
      expect.objectContaining({ kind: 'quest_pending', amount: 15, description: 'Tidy room' }),
    ])
  })

  it('fails the request instead of silently returning a partial ledger', async () => {
    vi.mocked(createServiceClient).mockReturnValue(makeClient({
      coin_transactions: { data: null, error: { message: 'relation unavailable' } },
      completions: { data: [], error: null },
      redemptions: { data: [], error: null },
    }) as unknown as ReturnType<typeof createServiceClient>)

    await expect(buildLedger('kid-1')).rejects.toThrow('relation unavailable')
  })
})
