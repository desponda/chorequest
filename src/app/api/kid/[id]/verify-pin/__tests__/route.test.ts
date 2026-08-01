import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(),
}))

import { createServiceClient } from '@/lib/supabase/service'
import { KID_SESSION_COOKIE } from '@/lib/kid-session'
import { POST } from '../route'

function request(pin: unknown) {
  return new NextRequest('http://localhost/api/kid/kid-1/verify-pin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin }),
  })
}

const params = { params: Promise.resolve({ id: 'kid-1' }) }

function mockResult(data: unknown, error: unknown = null) {
  vi.mocked(createServiceClient).mockReturnValue({
    rpc: vi.fn().mockResolvedValue({ data, error }),
  } as unknown as ReturnType<typeof createServiceClient>)
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('KID_SESSION_SECRET', 'test-secret')
})

describe('POST /api/kid/[id]/verify-pin', () => {
  it('issues the signed kid-session cookie after a correct PIN', async () => {
    mockResult({ success: true, retry_after: 0 })
    const response = await POST(request('1234'), params)
    expect(response.status).toBe(200)
    expect(response.headers.get('set-cookie')).toContain(`${KID_SESSION_COOKIE}=`)
  })

  it('returns 401 without a cookie after a wrong PIN', async () => {
    mockResult({ success: false, retry_after: 0 })
    const response = await POST(request('9999'), params)
    expect(response.status).toBe(401)
    expect(response.headers.get('set-cookie')).toBeNull()
  })

  it('returns a server-enforced lockout with Retry-After', async () => {
    mockResult({ success: false, retry_after: 30 })
    const response = await POST(request('9999'), params)
    expect(response.status).toBe(429)
    expect(response.headers.get('retry-after')).toBe('30')
    expect(await response.json()).toEqual({ success: false, retryAfter: 30 })
  })

  it('rejects malformed PINs before querying the database', async () => {
    const response = await POST(request('12'), params)
    expect(response.status).toBe(400)
    expect(createServiceClient).not.toHaveBeenCalled()
  })

  it('returns 500 when the limiter cannot be checked', async () => {
    mockResult(null, { message: 'offline' })
    const response = await POST(request('1234'), params)
    expect(response.status).toBe(500)
  })
})
