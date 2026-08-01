import { createServiceClient } from '@/lib/supabase/service'
import { NextRequest } from 'next/server'
import { requireKidSession } from '@/lib/kid-session'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; redemptionId: string }> }
) {
  const { id, redemptionId } = await params
  const authError = requireKidSession(req, id)
  if (authError) return authError
  const supabase = createServiceClient()

  const { data: deleted, error } = await supabase
    .from('redemptions')
    .delete()
    .eq('id', redemptionId)
    .eq('kid_id', id)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle()

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
  if (!deleted) return Response.json({ error: 'Not found or already approved' }, { status: 409 })

  return Response.json({ success: true })
}
