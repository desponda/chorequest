import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(),
}))

vi.mock('@/lib/api-auth', () => ({
  authenticate: vi.fn(),
  isAuthError: vi.fn(),
  cors: vi.fn(() => ({})),
}))

import { createServiceClient } from '@/lib/supabase/service'
import { authenticate, isAuthError } from '@/lib/api-auth'
import { GET, POST, OPTIONS } from '../route'

const AUTH_SUCCESS = { familyId: 'fam-1' }

function makeRequest(method: string, body?: object) {
  return new Request('http://localhost/api/curses', {
    method,
    ...(body ? { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } } : {}),
  })
}

type GetOpts = {
  curses?: object[]
  error?: { message: string } | null
}

function makeClientForGet(opts: GetOpts = {}) {
  const { curses = [], error = null } = opts
  return {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: curses, error }),
    })),
  }
}

type PostOpts = {
  plan?: string
  insertData?: object | null
  insertError?: { message: string } | null
}

function makeClientForPost(opts: PostOpts = {}) {
  const { plan = 'family', insertData = { id: 'curse-1', title: 'No dessert' }, insertError = null } = opts

  return {
    from: vi.fn((table: string) => {
      if (table === 'families') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { plan } }),
        }
      }
      if (table === 'curses') {
        return {
          insert: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: insertData, error: insertError }),
        }
      }
      return {}
    }),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(isAuthError).mockImplementation((r): r is Response => r instanceof Response)
})

describe('OPTIONS /api/curses', () => {
  it('returns 204', async () => {
    const res = await OPTIONS()
    expect(res.status).toBe(204)
  })
})

describe('GET /api/curses', () => {
  it('returns 401 when auth fails', async () => {
    const authErr = Response.json({ error: 'Invalid API key' }, { status: 401 })
    vi.mocked(authenticate).mockResolvedValue(authErr)
    vi.mocked(isAuthError).mockReturnValue(true)

    const res = await GET(makeRequest('GET'))
    expect(res.status).toBe(401)
  })

  it('returns curses list for authenticated family', async () => {
    vi.mocked(authenticate).mockResolvedValue(AUTH_SUCCESS)
    vi.mocked(isAuthError).mockReturnValue(false)
    const curses = [{ id: 'c1', title: 'No screen time' }, { id: 'c2', title: 'Early bedtime' }]
    vi.mocked(createServiceClient).mockReturnValue(
      makeClientForGet({ curses }) as unknown as ReturnType<typeof createServiceClient>
    )

    const res = await GET(makeRequest('GET'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.curses).toEqual(curses)
  })

  it('returns 500 on database error', async () => {
    vi.mocked(authenticate).mockResolvedValue(AUTH_SUCCESS)
    vi.mocked(isAuthError).mockReturnValue(false)
    vi.mocked(createServiceClient).mockReturnValue(
      makeClientForGet({ error: { message: 'DB failure' } }) as unknown as ReturnType<typeof createServiceClient>
    )

    const res = await GET(makeRequest('GET'))
    expect(res.status).toBe(500)
    expect((await res.json()).error).toBe('DB failure')
  })
})

describe('POST /api/curses', () => {
  it('returns 401 when auth fails', async () => {
    const authErr = Response.json({ error: 'Invalid API key' }, { status: 401 })
    vi.mocked(authenticate).mockResolvedValue(authErr)
    vi.mocked(isAuthError).mockReturnValue(true)

    const res = await POST(makeRequest('POST', { title: 'No dessert' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 when title is missing', async () => {
    vi.mocked(authenticate).mockResolvedValue(AUTH_SUCCESS)
    vi.mocked(isAuthError).mockReturnValue(false)
    vi.mocked(createServiceClient).mockReturnValue(
      makeClientForPost() as unknown as ReturnType<typeof createServiceClient>
    )

    const res = await POST(makeRequest('POST', {}))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/title/i)
  })

  it('returns 402 when plan does not include curses (free plan)', async () => {
    vi.mocked(authenticate).mockResolvedValue(AUTH_SUCCESS)
    vi.mocked(isAuthError).mockReturnValue(false)
    vi.mocked(createServiceClient).mockReturnValue(
      makeClientForPost({ plan: 'free' }) as unknown as ReturnType<typeof createServiceClient>
    )

    const res = await POST(makeRequest('POST', { title: 'No dessert' }))
    expect(res.status).toBe(402)
    expect((await res.json()).error).toMatch(/family plan/i)
  })

  it('creates a curse on family plan', async () => {
    vi.mocked(authenticate).mockResolvedValue(AUTH_SUCCESS)
    vi.mocked(isAuthError).mockReturnValue(false)
    vi.mocked(createServiceClient).mockReturnValue(
      makeClientForPost({ plan: 'family', insertData: { id: 'curse-1', title: 'No dessert', icon: '☠️', penalty: 10 } }) as unknown as ReturnType<typeof createServiceClient>
    )

    const res = await POST(makeRequest('POST', { title: 'No dessert' }))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.curse.title).toBe('No dessert')
  })

  it('creates a curse on legendary plan', async () => {
    vi.mocked(authenticate).mockResolvedValue(AUTH_SUCCESS)
    vi.mocked(isAuthError).mockReturnValue(false)
    vi.mocked(createServiceClient).mockReturnValue(
      makeClientForPost({ plan: 'legendary', insertData: { id: 'curse-2', title: 'Extra chores', icon: '🔥', penalty: 20 } }) as unknown as ReturnType<typeof createServiceClient>
    )

    const res = await POST(makeRequest('POST', { title: 'Extra chores', icon: '🔥', penalty: 20 }))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.curse.id).toBe('curse-2')
  })

  it('returns 500 on insert error', async () => {
    vi.mocked(authenticate).mockResolvedValue(AUTH_SUCCESS)
    vi.mocked(isAuthError).mockReturnValue(false)
    vi.mocked(createServiceClient).mockReturnValue(
      makeClientForPost({ plan: 'family', insertData: null, insertError: { message: 'Insert failed' } }) as unknown as ReturnType<typeof createServiceClient>
    )

    const res = await POST(makeRequest('POST', { title: 'No dessert' }))
    expect(res.status).toBe(500)
    expect((await res.json()).error).toBe('Insert failed')
  })

  it('uses default icon and penalty when not provided', async () => {
    vi.mocked(authenticate).mockResolvedValue(AUTH_SUCCESS)
    vi.mocked(isAuthError).mockReturnValue(false)

    let capturedInsertArgs: object | undefined
    const client = {
      from: vi.fn((table: string) => {
        if (table === 'families') {
          return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { plan: 'family' } }) }
        }
        if (table === 'curses') {
          return {
            insert: vi.fn((args: object) => {
              capturedInsertArgs = args
              return { select: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { id: 'c1', ...args }, error: null }) }
            }),
          }
        }
        return {}
      }),
    }
    vi.mocked(createServiceClient).mockReturnValue(client as unknown as ReturnType<typeof createServiceClient>)

    await POST(makeRequest('POST', { title: 'Grounded' }))
    expect(capturedInsertArgs).toMatchObject({ icon: '☠️', penalty: 10 })
  })
})
