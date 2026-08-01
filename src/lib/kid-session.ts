import { createHmac, timingSafeEqual } from 'node:crypto'
import type { NextRequest } from 'next/server'

export const KID_SESSION_COOKIE = 'cq_kid_session'
const SESSION_TTL_SECONDS = 12 * 60 * 60

function sessionSecret(): string {
  const secret = process.env.KID_SESSION_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) throw new Error('KID_SESSION_SECRET or SUPABASE_SERVICE_ROLE_KEY is required')
  return secret
}

function signature(payload: string): string {
  return createHmac('sha256', sessionSecret()).update(payload).digest('base64url')
}

export function createKidSessionToken(kidId: string, nowMs = Date.now()): string {
  const expiresAt = Math.floor(nowMs / 1000) + SESSION_TTL_SECONDS
  const payload = `${kidId}.${expiresAt}`
  return `${payload}.${signature(payload)}`
}

export function verifyKidSessionToken(token: string | undefined, kidId: string, nowMs = Date.now()): boolean {
  if (!token) return false
  const parts = token.split('.')
  if (parts.length !== 3) return false
  const [tokenKidId, expiresRaw, suppliedSignature] = parts
  if (tokenKidId !== kidId || !/^\d+$/.test(expiresRaw)) return false
  if (Number(expiresRaw) <= Math.floor(nowMs / 1000)) return false

  const expectedSignature = signature(`${tokenKidId}.${expiresRaw}`)
  const supplied = Buffer.from(suppliedSignature)
  const expected = Buffer.from(expectedSignature)
  return supplied.length === expected.length && timingSafeEqual(supplied, expected)
}

export function requireKidSession(req: NextRequest, kidId: string): Response | null {
  const token = req.cookies.get(KID_SESSION_COOKIE)?.value
  return verifyKidSessionToken(token, kidId)
    ? null
    : Response.json({ error: 'Kid PIN verification required' }, { status: 401 })
}

export const kidSessionCookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  maxAge: SESSION_TTL_SECONDS,
  path: '/',
}
