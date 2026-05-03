import { createServiceClient } from '@/lib/supabase/service'
import { NextRequest } from 'next/server'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const body = await req.json().catch(() => null)
  if (!body?.reward_id || typeof body.reward_id !== 'string') {
    return Response.json({ error: 'Invalid request' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Verify kid exists
  const { data: kid } = await supabase.from('kids').select('id').eq('id', id).single()
  if (!kid) return Response.json({ error: 'Not found' }, { status: 404 })

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
