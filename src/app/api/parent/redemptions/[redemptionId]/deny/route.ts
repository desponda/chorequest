import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextRequest } from 'next/server'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ redemptionId: string }> }
) {
  const { redemptionId } = await params

  const userClient = await createClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('family_id')
    .eq('id', user.id)
    .single()
  if (!profile) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: redemption } = await supabase
    .from('redemptions')
    .select('id, status, kid:kids(family_id)')
    .eq('id', redemptionId)
    .single()

  if (!redemption) return Response.json({ error: 'Not found' }, { status: 404 })

  const kid = redemption.kid as unknown as { family_id: string } | null
  if (!kid || kid.family_id !== profile.family_id) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Soft-delete: preserve row with status='denied' for audit trail
  const { data: updated } = await supabase
    .from('redemptions')
    .update({ status: 'denied', processed_at: new Date().toISOString() })
    .eq('id', redemptionId)
    .eq('status', 'pending')
    .select('id')

  if (!updated || updated.length === 0) {
    return Response.json({ error: 'Already processed' }, { status: 409 })
  }

  return Response.json({ success: true })
}
