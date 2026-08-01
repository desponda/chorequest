import { createServiceClient } from '@/lib/supabase/service'
import { NextRequest } from 'next/server'
import { requireKidSession } from '@/lib/kid-session'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const authError = requireKidSession(req, id)
  if (authError) return authError

  const body = await req.json().catch(() => null)
  if (!body?.reward_id || typeof body.reward_id !== 'string') {
    return Response.json({ error: 'Invalid request' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const [kidRes, rewardRes] = await Promise.all([
    supabase.from('kids').select('id, coins, family_id').eq('id', id).single(),
    supabase.from('rewards').select('id, cost, family_id').eq('id', body.reward_id).eq('available', true).eq('archived', false).single(),
  ])

  if (!kidRes.data) return Response.json({ error: 'Not found' }, { status: 404 })
  if (!rewardRes.data) return Response.json({ error: 'Reward not found' }, { status: 404 })
  if (kidRes.data.family_id !== rewardRes.data.family_id) {
    return Response.json({ error: 'Reward not found' }, { status: 404 })
  }
  if (!Number.isInteger(rewardRes.data.cost) || rewardRes.data.cost <= 0) {
    return Response.json({ error: 'Reward has an invalid cost' }, { status: 422 })
  }

  const { data: pending, error: pendingError } = await supabase
    .from('redemptions')
    .select('cost_charged, reward:rewards(cost)')
    .eq('kid_id', id)
    .eq('status', 'pending')

  if (pendingError) {
    return Response.json({ error: pendingError.message }, { status: 500 })
  }

  const pendingTotal = (pending ?? []).reduce((sum, r) => {
    return sum + (r.cost_charged ?? (r.reward as unknown as { cost: number } | null)?.cost ?? 0)
  }, 0)

  if (kidRes.data.coins - pendingTotal < rewardRes.data.cost) {
    return Response.json({ error: 'Insufficient coins' }, { status: 400 })
  }

  const { error } = await supabase.from('redemptions').insert({
    reward_id: body.reward_id,
    kid_id: id,
    status: 'pending',
    cost_charged: rewardRes.data.cost,
  })

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ success: true })
}
