import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(),
}))

import { createServiceClient } from '@/lib/supabase/service'
import { POST } from '../route'

function makeRequest(body: object) {
  return new NextRequest('http://localhost/api/kid/kid-1/complete', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

function makeParams(id = 'kid-1') {
  return { params: Promise.resolve({ id }) }
}

type Opts = {
  kid?: { id: string } | null
  insertError?: { code: string; message: string } | null
}

function makeClient(opts: Opts = {}) {
  const { kid = { id: 'kid-1' }, insertError = null } = opts
  return {
    from: vi.fn((table: string) => {
      if (table === 'kids') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: kid }),
        }
      }
      if (table === 'completions') {
        return {
          insert: vi.fn().mockResolvedValue({ error: insertError }),
        }
      }
      return {}
    }),
  }
}

beforeEach(() => { vi.clearAllMocks() })

describe('POST /api/kid/[id]/complete', () => {
  it('returns 400 when quest_id is missing', async () => {
    vi.mocked(createServiceClient).mockReturnValue(
      makeClient() as unknown as ReturnType<typeof createServiceClient>
    )
    const res = await POST(makeRequest({ date: '2026-05-05' }), makeParams())
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/invalid/i)
  })

  it('returns 400 when date is missing', async () => {
    vi.mocked(createServiceClient).mockReturnValue(
      makeClient() as unknown as ReturnType<typeof createServiceClient>
    )
    const res = await POST(makeRequest({ quest_id: 'q-1' }), makeParams())
    expect(res.status).toBe(400)
  })

  it('returns 400 when quest_id is not a string', async () => {
    vi.mocked(createServiceClient).mockReturnValue(
      makeClient() as unknown as ReturnType<typeof createServiceClient>
    )
    const res = await POST(makeRequest({ quest_id: 42, date: '2026-05-05' }), makeParams())
    expect(res.status).toBe(400)
  })

  it('returns 400 when date is not a string', async () => {
    vi.mocked(createServiceClient).mockReturnValue(
      makeClient() as unknown as ReturnType<typeof createServiceClient>
    )
    const res = await POST(makeRequest({ quest_id: 'q-1', date: 99 }), makeParams())
    expect(res.status).toBe(400)
  })

  it('returns 400 when body is empty JSON object', async () => {
    vi.mocked(createServiceClient).mockReturnValue(
      makeClient() as unknown as ReturnType<typeof createServiceClient>
    )
    const res = await POST(makeRequest({}), makeParams())
    expect(res.status).toBe(400)
  })

  it('returns 404 when kid does not exist', async () => {
    vi.mocked(createServiceClient).mockReturnValue(
      makeClient({ kid: null }) as unknown as ReturnType<typeof createServiceClient>
    )
    const res = await POST(makeRequest({ quest_id: 'q-1', date: '2026-05-05' }), makeParams())
    expect(res.status).toBe(404)
    expect((await res.json()).error).toMatch(/not found/i)
  })

  it('returns 200 and success:true on valid completion', async () => {
    vi.mocked(createServiceClient).mockReturnValue(
      makeClient() as unknown as ReturnType<typeof createServiceClient>
    )
    const res = await POST(makeRequest({ quest_id: 'q-1', date: '2026-05-05' }), makeParams())
    expect(res.status).toBe(200)
    expect((await res.json()).success).toBe(true)
  })

  it('returns 409 on duplicate completion (23505 unique violation)', async () => {
    vi.mocked(createServiceClient).mockReturnValue(
      makeClient({ insertError: { code: '23505', message: 'duplicate key' } }) as unknown as ReturnType<typeof createServiceClient>
    )
    const res = await POST(makeRequest({ quest_id: 'q-1', date: '2026-05-05' }), makeParams())
    expect(res.status).toBe(409)
    expect((await res.json()).error).toBe('23505')
  })

  it('returns 500 on generic insert error', async () => {
    vi.mocked(createServiceClient).mockReturnValue(
      makeClient({ insertError: { code: '99999', message: 'something broke' } }) as unknown as ReturnType<typeof createServiceClient>
    )
    const res = await POST(makeRequest({ quest_id: 'q-1', date: '2026-05-05' }), makeParams())
    expect(res.status).toBe(500)
  })
})
