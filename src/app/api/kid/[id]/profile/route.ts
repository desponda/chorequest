import { createServiceClient } from '@/lib/supabase/service'
import { NextRequest } from 'next/server'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServiceClient()
  const { data: kid } = await supabase
    .from('kids')
    .select('id, name, avatar, color')
    .eq('id', id)
    .single()

  if (!kid) return Response.json({ error: 'Not found' }, { status: 404 })
  return Response.json({ kid })
}
