import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextRequest } from 'next/server'
import { buildLedger } from '@/lib/ledger'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ kidId: string }> }
) {
  const { kidId } = await params

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

  const { data: kid } = await supabase
    .from('kids')
    .select('id, coins, family_id, name')
    .eq('id', kidId)
    .single()

  if (!kid || kid.family_id !== profile.family_id) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { ledger } = await buildLedger(kidId, kid.coins)
  return Response.json({ ledger, currentBalance: kid.coins, kidName: kid.name })
}
