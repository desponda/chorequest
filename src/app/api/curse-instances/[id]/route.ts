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

  const supabase = createServiceClient()

  const { data: instance, error: fetchErr } = await supabase
    .from('curse_instances')
    .select('*, kid:kids(id, coins, family_id)')
    .eq('id', id)
    .single()

  if (fetchErr || !instance) {
    return Response.json({ error: 'Instance not found' }, { status: 404, headers: cors() })
  }

  const kid = instance.kid as { id: string; coins: number; family_id: string } | null
  if (!kid || kid.family_id !== auth.familyId) {
    return Response.json({ error: 'Not authorized' }, { status: 403, headers: cors() })
  }

  if (body.refund === true) {
    await supabase.from('kids').update({ coins: kid.coins + instance.coins_deducted }).eq('id', kid.id)
  }

  const { data, error } = await supabase
    .from('curse_instances')
    .update({ status: 'resolved', resolved_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500, headers: cors() })
  return Response.json({ instance: data }, { headers: cors() })
}
