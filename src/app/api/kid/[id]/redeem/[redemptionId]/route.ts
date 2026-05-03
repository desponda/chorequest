import { createServiceClient } from '@/lib/supabase/service'
import { NextRequest } from 'next/server'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; redemptionId: string }> }
) {
  const { id, redemptionId } = await params
  const supabase = createServiceClient()

  const { data: redemption } = await supabase
    .from('redemptions')
    .select('id')
    .eq('id', redemptionId)
    .eq('kid_id', id)
    .eq('status', 'pending')
    .single()

  if (!redemption) {
    return Response.json({ error: 'Not found or already approved' }, { status: 404 })
  }

  const { error } = await supabase.from('redemptions').delete().eq('id', redemptionId)

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ success: true })
}
