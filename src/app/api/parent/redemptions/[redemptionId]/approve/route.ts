import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextRequest } from 'next/server'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ redemptionId: string }> }
) {
  const { redemptionId } = await params

  // Verify caller is authenticated as a parent in the family that owns this redemption
  const userClient = await createClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()

  // Fetch the redemption and verify it belongs to this parent's family
  const { data: profile } = await supabase
    .from('profiles')
    .select('family_id')
    .eq('id', user.id)
    .single()
  if (!profile) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: redemption } = await supabase
    .from('redemptions')
    .select('id, status, kid_id, cost_charged, reward:rewards(id, cost), kid:kids(id, coins, family_id)')
    .eq('id', redemptionId)
    .single()

  if (!redemption) return Response.json({ error: 'Not found' }, { status: 404 })

  const kid = redemption.kid as unknown as { id: string; coins: number; family_id: string } | null
  const reward = redemption.reward as unknown as { id: string; cost: number } | null
  if (!kid || !reward) return Response.json({ error: 'Invalid redemption' }, { status: 422 })
  const cost = redemption.cost_charged ?? reward.cost

  // Ensure this kid belongs to the parent's family
  if (kid.family_id !== profile.family_id) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!Number.isInteger(cost) || cost <= 0) {
    return Response.json({ error: 'Reward has an invalid cost' }, { status: 422 })
  }

  // Validate against a fresh balance before changing the redemption state.
  const { data: freshKid, error: freshKidError } = await supabase
    .from('kids')
    .select('coins')
    .eq('id', kid.id)
    .single()

  if (freshKidError || !freshKid) {
    return Response.json({ error: 'Could not read the current balance' }, { status: 500 })
  }
  if (freshKid.coins < cost) {
    return Response.json({ error: 'Insufficient coins; deny the request or adjust the balance' }, { status: 409 })
  }

  // Idempotency: only process pending redemptions — prevents double-deduction
  const { data: updated } = await supabase
    .from('redemptions')
    .update({ status: 'approved', cost_charged: cost })
    .eq('id', redemptionId)
    .eq('status', 'pending')
    .select('id')

  if (!updated || updated.length === 0) {
    return Response.json({ error: 'Already processed' }, { status: 409 })
  }

  const balanceAfter = freshKid.coins - cost
  const { data: charged, error: chargeError } = await supabase
    .from('kids')
    .update({ coins: balanceAfter })
    .eq('id', kid.id)
    .eq('coins', freshKid.coins)
    .select('id')
    .maybeSingle()

  if (chargeError || !charged) {
    // A concurrent balance change invalidated the approval. Return it to the
    // pending queue so a parent can retry against the new balance.
    const { error: rollbackError } = await supabase
      .from('redemptions')
      .update({ status: 'pending' })
      .eq('id', redemptionId)
      .eq('status', 'approved')

    return Response.json(
      { error: rollbackError ? 'Balance changed and approval rollback failed' : 'Balance changed; try again' },
      { status: rollbackError ? 500 : 409 },
    )
  }

  return Response.json({ success: true, coinsDeducted: cost, balanceAfter })
}
