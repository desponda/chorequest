import { createServiceClient } from '@/lib/supabase/service'
import { buildLedger } from '@/lib/ledger'
import { NextRequest } from 'next/server'

export type { LedgerEntry } from '@/lib/ledger'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = createServiceClient()

  const { data: kid } = await supabase
    .from('kids')
    .select('id, coins, family_id')
    .eq('id', id)
    .single()

  if (!kid) return Response.json({ error: 'Not found' }, { status: 404 })

  const { ledger } = await buildLedger(id, kid.coins)
  return Response.json({ ledger, currentBalance: kid.coins })
}
