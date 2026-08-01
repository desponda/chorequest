import { authenticate, isAuthError, cors } from '@/lib/api-auth'
import { createServiceClient } from '@/lib/supabase/service'
import { boundedInteger, nonEmptyString } from '@/lib/validation'

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: cors() })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticate(req)
  if (isAuthError(auth)) return auth

  const { id } = await params
  const parsed = await req.json().catch(() => null)
  const body: Record<string, unknown> = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}

  const updates: Record<string, unknown> = {}
  if ('title' in body) {
    const title = nonEmptyString(body.title)
    if (!title) return Response.json({ error: '`title` cannot be blank' }, { status: 400, headers: cors() })
    updates.title = title
  }
  if ('icon' in body) {
    const icon = nonEmptyString(body.icon)
    if (!icon) return Response.json({ error: '`icon` must be non-empty text' }, { status: 400, headers: cors() })
    updates.icon = icon
  }
  if ('penalty' in body) {
    const penalty = boundedInteger(body.penalty, { min: 1, max: 1_000_000 })
    if (penalty === null) return Response.json({ error: '`penalty` must be a positive integer' }, { status: 400, headers: cors() })
    updates.penalty = penalty
  }

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: 'No valid fields to update' }, { status: 400, headers: cors() })
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('curses')
    .update(updates)
    .eq('id', id)
    .eq('family_id', auth.familyId)
    .eq('archived', false)
    .select()
    .single()

  if (error || !data) {
    return Response.json({ error: error?.message ?? 'Curse not found' }, { status: error ? 500 : 404, headers: cors() })
  }

  return Response.json({ curse: data }, { headers: cors() })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticate(req)
  if (isAuthError(auth)) return auth

  const { id } = await params
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('curses')
    .update({ archived: true })
    .eq('id', id)
    .eq('family_id', auth.familyId)
    .eq('archived', false)
    .select('id')
    .maybeSingle()

  if (error) return Response.json({ error: error.message }, { status: 500, headers: cors() })
  if (!data) return Response.json({ error: 'Curse not found' }, { status: 404, headers: cors() })
  return Response.json({ deleted: true }, { headers: cors() })
}
