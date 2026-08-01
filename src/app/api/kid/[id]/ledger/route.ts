import { createServiceClient } from '@/lib/supabase/service'
import { buildLedger } from '@/lib/ledger'
import { NextRequest } from 'next/server'
import { requireKidSession } from '@/lib/kid-session'

export type { LedgerEntry, PendingLedgerEntry } from '@/lib/ledger'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const authError = requireKidSession(req, id)
  if (authError) return authError
  const supabase = createServiceClient()

  const { data: kid } = await supabase
    .from('kids')
    .select('id, coins, family_id')
    .eq('id', id)
    .single()

  if (!kid) return Response.json({ error: 'Not found' }, { status: 404 })

  try {
    const { ledger, pending } = await buildLedger(id)
    const pendingDebits = pending.reduce((sum, entry) => sum + Math.min(0, entry.amount), 0)
    return Response.json({
      ledger,
      pending,
      currentBalance: kid.coins,
      availableBalance: Math.max(0, kid.coins + pendingDebits),
    })
  } catch (error) {
    console.error('Failed to build kid ledger', error)
    return Response.json({ error: 'Could not load coin history' }, { status: 500 })
  }
}
