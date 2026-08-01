import { createServiceClient } from '@/lib/supabase/service'
import { isValidPin } from '@/lib/utils'
import { createKidSessionToken, KID_SESSION_COOKIE, kidSessionCookieOptions } from '@/lib/kid-session'
import { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const body = await req.json().catch(() => null)
  if (!isValidPin(body?.pin)) {
    return Response.json({ error: 'Invalid request' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase.rpc('verify_kid_pin', {
    p_kid_id: id,
    p_pin: body.pin,
  })
  if (error) {
    return Response.json({ error: 'Could not verify PIN' }, { status: 500 })
  }

  const result = data as { success?: boolean; retry_after?: number } | null
  const success = result?.success === true
  const retryAfter = Math.max(0, result?.retry_after ?? 0)
  const response = NextResponse.json(
    { success, retryAfter },
    {
      status: success ? 200 : retryAfter > 0 ? 429 : 401,
      headers: retryAfter > 0 ? { 'Retry-After': String(retryAfter) } : undefined,
    },
  )
  if (success) {
    response.cookies.set(KID_SESSION_COOKIE, createKidSessionToken(id), kidSessionCookieOptions)
  }
  return response
}
