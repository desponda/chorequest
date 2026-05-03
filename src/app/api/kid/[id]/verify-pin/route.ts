import { createServiceClient } from '@/lib/supabase/service'
import { isValidPin } from '@/lib/utils'
import { NextRequest } from 'next/server'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const body = await req.json().catch(() => null)
  if (!isValidPin(body?.pin)) {
    return Response.json({ error: 'Invalid request' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data: kid } = await supabase
    .from('kids')
    .select('pin')
    .eq('id', id)
    .single()

  if (!kid) {
    // Return 401 (not 404) to avoid confirming whether a kid ID exists
    return Response.json({ success: false }, { status: 401 })
  }

  const success = kid.pin === body.pin
  return Response.json({ success }, { status: success ? 200 : 401 })
}
