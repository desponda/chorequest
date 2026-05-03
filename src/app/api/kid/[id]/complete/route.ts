import { createServiceClient } from '@/lib/supabase/service'
import { NextRequest } from 'next/server'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const body = await req.json().catch(() => null)
  if (!body?.quest_id || typeof body.quest_id !== 'string' || !body?.date || typeof body.date !== 'string') {
    return Response.json({ error: 'Invalid request' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Verify kid exists
  const { data: kid } = await supabase.from('kids').select('id').eq('id', id).single()
  if (!kid) return Response.json({ error: 'Not found' }, { status: 404 })

  const { error } = await supabase.from('completions').insert({
    quest_id: body.quest_id,
    kid_id: id,
    status: 'pending',
    date: body.date,
  })

  if (error) {
    return Response.json({ error: error.code }, { status: error.code === '23505' ? 409 : 500 })
  }

  return Response.json({ success: true })
}
