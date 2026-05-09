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
    .select('id, status, kid_id, reward:rewards(id, cost), kid:kids(id, coins, family_id)')
    .eq('id', redemptionId)
    .single()

  if (!redemption) return Response.json({ error: 'Not found' }, { status: 404 })

  const kid = redemption.kid as unknown as { id: string; coins: number; family_id: string } | null
  const reward = redemption.reward as unknown as { id: string; cost: number } | null
  if (!kid || !reward) return Response.json({ error: 'Invalid redemption' }, { status: 422 })

  // Ensure this kid belongs to the parent's family
  if (kid.family_id !== profile.family_id) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Idempotency: only process pending redemptions — prevents double-deduction
  const { data: updated } = await supabase
    .from('redemptions')
    .update({ status: 'approved' })
    .eq('id', redemptionId)
    .eq('status', 'pending')
    .select('id')

  if (!updated || updated.length === 0) {
    return Response.json({ error: 'Already processed' }, { status: 409 })
  }

  // Fetch fresh coin balance from DB — never trust caller-supplied value
  const { data: freshKid } = await supabase
    .from('kids')
    .select('coins')
    .eq('id', kid.id)
    .single()

  const currentCoins = freshKid?.coins ?? kid.coins
  await supabase
    .from('kids')
    .update({ coins: Math.max(0, currentCoins - reward.cost) })
    .eq('id', kid.id)

  return Response.json({ success: true, coinsDeducted: reward.cost, balanceAfter: Math.max(0, currentCoins - reward.cost) })
}
