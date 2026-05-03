import { authenticate, isAuthError, cors } from '@/lib/api-auth'
import { createServiceClient } from '@/lib/supabase/service'

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: cors() })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticate(req)
  if (isAuthError(auth)) return auth

  const { id } = await params
  const body = await req.json().catch(() => ({}))

  const allowed = ['title', 'description', 'icon', 'coins', 'assigned_to', 'frequency', 'active']
  const updates: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: 'No valid fields to update' }, { status: 400, headers: cors() })
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('quests')
    .update(updates)
    .eq('id', id)
    .eq('family_id', auth.familyId)
    .select()
    .single()

  if (error || !data) {
    return Response.json({ error: error?.message ?? 'Quest not found' }, { status: error ? 500 : 404, headers: cors() })
  }

  return Response.json({ quest: data }, { headers: cors() })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticate(req)
  if (isAuthError(auth)) return auth

  const { id } = await params
  const supabase = createServiceClient()

  const { error } = await supabase
    .from('quests')
    .delete()
    .eq('id', id)
    .eq('family_id', auth.familyId)

  if (error) return Response.json({ error: error.message }, { status: 500, headers: cors() })

  return Response.json({ deleted: true }, { headers: cors() })
}
