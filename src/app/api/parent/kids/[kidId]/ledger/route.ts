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

  try {
    const { ledger, pending } = await buildLedger(kidId)
    const pendingDebits = pending.reduce((sum, entry) => sum + Math.min(0, entry.amount), 0)
    return Response.json({
      ledger,
      pending,
      currentBalance: kid.coins,
      availableBalance: Math.max(0, kid.coins + pendingDebits),
      kidName: kid.name,
    })
  } catch (error) {
    console.error('Failed to build parent ledger', error)
    return Response.json({ error: 'Could not load coin history' }, { status: 500 })
  }
}
