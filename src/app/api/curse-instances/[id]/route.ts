import { authenticate, isAuthError, cors } from '@/lib/api-auth'
import { createServiceClient } from '@/lib/supabase/service'

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: cors() })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticate(req)
  if (isAuthError(auth)) return auth

  const { id } = await params
  const parsed = await req.json().catch(() => null)
  const body: Record<string, unknown> = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}

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

  if (body.reopen === true) {
    if (instance.status !== 'resolved') {
      return Response.json({ error: 'Curse is already active' }, { status: 409, headers: cors() })
    }

    const coinsDeducted = instance.refunded
      ? Math.min(kid.coins, instance.coins_deducted)
      : instance.coins_deducted

    if (instance.refunded) {
      const { data: charged, error: chargeError } = await supabase
        .from('kids')
        .update({ coins: kid.coins - coinsDeducted })
        .eq('id', kid.id)
        .eq('coins', kid.coins)
        .select('id')
        .maybeSingle()
      if (chargeError || !charged) {
        return Response.json({ error: 'Balance changed; try again' }, { status: 409, headers: cors() })
      }
    }

    const { data: reopened, error: reopenError } = await supabase
      .from('curse_instances')
      .update({
        status: 'active',
        resolved_at: null,
        refunded: false,
        coins_deducted: coinsDeducted,
      })
      .eq('id', id)
      .eq('status', 'resolved')
      .select()
      .maybeSingle()

    if (reopenError || !reopened) {
      if (instance.refunded) {
        await supabase
          .from('kids')
          .update({ coins: kid.coins })
          .eq('id', kid.id)
          .eq('coins', kid.coins - coinsDeducted)
      }
      return Response.json({ error: reopenError?.message ?? 'Curse state changed; try again' }, { status: reopenError ? 500 : 409, headers: cors() })
    }

    return Response.json({ instance: reopened }, { headers: cors() })
  }

  const refund = body.refund === true
  const { data, error } = await supabase
    .from('curse_instances')
    .update({ status: 'resolved', resolved_at: new Date().toISOString(), refunded: refund })
    .eq('id', id)
    .eq('status', 'active')
    .select()
    .maybeSingle()

  if (error) return Response.json({ error: error.message }, { status: 500, headers: cors() })
  if (!data) return Response.json({ error: 'Curse was already resolved' }, { status: 409, headers: cors() })

  if (refund) {
    const { data: refunded, error: refundError } = await supabase
      .from('kids')
      .update({ coins: kid.coins + instance.coins_deducted })
      .eq('id', kid.id)
      .eq('coins', kid.coins)
      .select('id')
      .maybeSingle()

    if (refundError || !refunded) {
      await supabase
        .from('curse_instances')
        .update({ status: 'active', resolved_at: null, refunded: false })
        .eq('id', id)
        .eq('status', 'resolved')
      return Response.json({ error: 'Balance changed; try again' }, { status: 409, headers: cors() })
    }
  }

  return Response.json({ instance: data }, { headers: cors() })
}
