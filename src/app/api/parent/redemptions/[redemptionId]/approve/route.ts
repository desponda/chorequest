import { createClient } from '@/lib/supabase/server'
import { NextRequest } from 'next/server'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ redemptionId: string }> },
) {
  const { redemptionId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase.rpc('approve_redemption_with_ledger', {
    p_redemption_id: redemptionId,
  })
  const result = data as {
    applied?: boolean
    reason?: string
    coins_deducted?: number
    balance_after?: number
  } | null

  if (error) {
    const status = error.code === '42501' ? 403 : 500
    return Response.json({ error: status === 403 ? 'Forbidden' : 'Could not process redemption' }, { status })
  }
  if (!result?.applied) {
    if (result?.reason === 'not_found') return Response.json({ error: 'Not found' }, { status: 404 })
    if (result?.reason === 'insufficient_coins') {
      return Response.json({ error: 'Insufficient coins; deny the request or adjust the balance' }, { status: 409 })
    }
    if (result?.reason === 'invalid_cost' || result?.reason === 'invalid_source') {
      return Response.json({ error: 'Invalid redemption' }, { status: 422 })
    }
    return Response.json({ error: 'Already processed' }, { status: 409 })
  }

  return Response.json({
    success: true,
    coinsDeducted: result.coins_deducted,
    balanceAfter: result.balance_after,
  })
}
