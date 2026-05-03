import { createServiceClient } from '@/lib/supabase/service'
import { NextRequest } from 'next/server'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const body = await req.json().catch(() => null)
  if (!body?.reward_id || typeof body.reward_id !== 'string') {
    return Response.json({ error: 'Invalid request' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const [kidRes, rewardRes] = await Promise.all([
    supabase.from('kids').select('id, coins').eq('id', id).single(),
    supabase.from('rewards').select('id, cost').eq('id', body.reward_id).eq('available', true).single(),
  ])

  if (!kidRes.data) return Response.json({ error: 'Not found' }, { status: 404 })
  if (!rewardRes.data) return Response.json({ error: 'Reward not found' }, { status: 404 })

  const { data: pending } = await supabase
    .from('redemptions')
    .select('reward:rewards(cost)')
    .eq('kid_id', id)
    .eq('status', 'pending')

  const pendingTotal = (pending ?? []).reduce((sum, r) => {
    return sum + ((r.reward as unknown as { cost: number } | null)?.cost ?? 0)
  }, 0)

  if (kidRes.data.coins - pendingTotal < rewardRes.data.cost) {
    return Response.json({ error: 'Insufficient coins' }, { status: 400 })
  }

  const { error } = await supabase.from('redemptions').insert({
    reward_id: body.reward_id,
    kid_id: id,
    status: 'pending',
  })

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ success: true })
}
