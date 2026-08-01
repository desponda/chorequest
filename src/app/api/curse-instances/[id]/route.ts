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
    .select('*, kid:kids(id, coins, family_id), curse:curses(id, title, icon)')
    .eq('id', id)
    .single()

  if (fetchErr || !instance) {
    return Response.json({ error: 'Instance not found' }, { status: 404, headers: cors() })
  }

  const kid = instance.kid as { id: string; coins: number; family_id: string } | null
  const curse = instance.curse as { id: string; title: string; icon: string } | null
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

    const reopenedAt = new Date().toISOString()
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
      return Response.json({ error: reopenError?.message ?? 'Curse state changed; try again' }, { status: reopenError ? 500 : 409, headers: cors() })
    }

    if (instance.refunded) {
      const { data: charged, error: chargeError } = await supabase.rpc('apply_coin_transaction', {
        p_kid_id: kid.id,
        p_expected_balance: kid.coins,
        p_new_balance: kid.coins - coinsDeducted,
        p_kind: 'curse_reopened',
        p_description: `${curse?.title ?? 'Curse'} reopened`,
        p_icon: curse?.icon ?? '☠️',
        p_source_id: `${id}:reopen:${reopenedAt}`,
        p_new_xp: null,
        p_new_streak: null,
        p_last_completed_date: null,
        p_update_progress: false,
        p_occurred_at: reopenedAt,
        p_metadata: { curse_id: curse?.id ?? instance.curse_id, instance_id: id },
      })
      const chargeResult = charged as { applied?: boolean } | null
      if (chargeError || !chargeResult?.applied) {
        const { error: rollbackError } = await supabase
          .from('curse_instances')
          .update({
            status: 'resolved',
            resolved_at: instance.resolved_at,
            refunded: true,
            coins_deducted: instance.coins_deducted,
          })
          .eq('id', id)
          .eq('status', 'active')
        return Response.json(
          { error: rollbackError ? 'Balance changed and curse rollback failed' : 'Balance changed; try again' },
          { status: rollbackError ? 500 : 409, headers: cors() },
        )
      }
    }

    return Response.json({ instance: reopened }, { headers: cors() })
  }

  const refund = body.refund === true
  const resolvedAt = new Date().toISOString()
  const { data, error } = await supabase
    .from('curse_instances')
    .update({ status: 'resolved', resolved_at: resolvedAt, refunded: refund })
    .eq('id', id)
    .eq('status', 'active')
    .select()
    .maybeSingle()

  if (error) return Response.json({ error: error.message }, { status: 500, headers: cors() })
  if (!data) return Response.json({ error: 'Curse was already resolved' }, { status: 409, headers: cors() })

  if (refund) {
    const { data: refunded, error: refundError } = await supabase.rpc('apply_coin_transaction', {
      p_kid_id: kid.id,
      p_expected_balance: kid.coins,
      p_new_balance: kid.coins + instance.coins_deducted,
      p_kind: 'curse_refund',
      p_description: `${curse?.title ?? 'Curse'} forgiven`,
      p_icon: curse?.icon ?? '☠️',
      p_source_id: `${id}:refund:${resolvedAt}`,
      p_new_xp: null,
      p_new_streak: null,
      p_last_completed_date: null,
      p_update_progress: false,
      p_occurred_at: resolvedAt,
      p_metadata: { curse_id: curse?.id ?? instance.curse_id, instance_id: id },
    })
    const refundResult = refunded as { applied?: boolean } | null

    if (refundError || !refundResult?.applied) {
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
