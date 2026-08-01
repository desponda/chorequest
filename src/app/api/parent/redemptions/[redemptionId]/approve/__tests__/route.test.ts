import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

import { createClient } from '@/lib/supabase/server'
import { POST } from '../route'

function request() {
  return new NextRequest('http://localhost/api/parent/redemptions/redemption-1/approve', { method: 'POST' })
}

function params() {
  return { params: Promise.resolve({ redemptionId: 'redemption-1' }) }
}

function client(options: {
  user?: { id: string } | null
  data?: unknown
  error?: { code?: string } | null
} = {}) {
  const rpc = vi.fn().mockResolvedValue({
    data: options.data ?? null,
    error: options.error ?? null,
  })
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: options.user === undefined ? { id: 'parent-1' } : options.user } }) },
    rpc,
  }
}

beforeEach(() => vi.clearAllMocks())

describe('POST parent redemption approval', () => {
  it('requires an authenticated parent', async () => {
    vi.mocked(createClient).mockResolvedValue(client({ user: null }) as never)

    const response = await POST(request(), params())

    expect(response.status).toBe(401)
  })

  it('uses the atomic redemption-and-ledger function', async () => {
    const mockClient = client({
      data: { applied: true, coins_deducted: 20, balance_after: 80 },
    })
    vi.mocked(createClient).mockResolvedValue(mockClient as never)

    const response = await POST(request(), params())

    expect(response.status).toBe(200)
    expect(mockClient.rpc).toHaveBeenCalledWith('approve_redemption_with_ledger', {
      p_redemption_id: 'redemption-1',
    })
    expect(await response.json()).toEqual({ success: true, coinsDeducted: 20, balanceAfter: 80 })
  })

  it('returns a conflict when available coins changed', async () => {
    vi.mocked(createClient).mockResolvedValue(client({
      data: { applied: false, reason: 'insufficient_coins' },
    }) as never)

    const response = await POST(request(), params())

    expect(response.status).toBe(409)
    expect((await response.json()).error).toMatch(/insufficient/i)
  })

  it('does not expose another family redemption', async () => {
    vi.mocked(createClient).mockResolvedValue(client({
      error: { code: '42501' },
    }) as never)

    const response = await POST(request(), params())

    expect(response.status).toBe(403)
  })
})
