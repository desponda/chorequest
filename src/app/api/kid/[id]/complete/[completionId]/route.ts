import { createServiceClient } from '@/lib/supabase/service'
import { NextRequest } from 'next/server'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; completionId: string }> }
) {
  const { id, completionId } = await params
  const supabase = createServiceClient()

  const { data: completion } = await supabase
    .from('completions')
    .select('id')
    .eq('id', completionId)
    .eq('kid_id', id)
    .eq('status', 'pending')
    .single()

  if (!completion) {
    return Response.json({ error: 'Not found or already reviewed' }, { status: 404 })
  }

  const { error } = await supabase.from('completions').delete().eq('id', completionId)

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ success: true })
}
