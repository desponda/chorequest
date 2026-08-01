import { authenticate, isAuthError, cors } from '@/lib/api-auth'
import { createServiceClient } from '@/lib/supabase/service'

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: cors() })
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticate(req)
  if (isAuthError(auth)) return auth

  const { id } = await params
  const body = await req.json().catch(() => null)
  if (!body?.kid_id) {
    return Response.json({ error: '`kid_id` is required' }, { status: 400, headers: cors() })
  }

  const supabase = createServiceClient()

  const [curseRes, kidRes] = await Promise.all([
    supabase.from('curses').select('*').eq('id', id).eq('family_id', auth.familyId).eq('archived', false).single(),
    supabase.from('kids').select('id, coins').eq('id', body.kid_id).eq('family_id', auth.familyId).single(),
  ])

  if (!curseRes.data) return Response.json({ error: 'Curse not found' }, { status: 404, headers: cors() })
  if (!kidRes.data) return Response.json({ error: 'Kid not found' }, { status: 404, headers: cors() })

  const curse = curseRes.data
  const kid = kidRes.data
  if (!Number.isInteger(curse.penalty) || curse.penalty <= 0) {
    return Response.json({ error: 'Curse has an invalid penalty' }, { status: 422, headers: cors() })
  }
  const coinsDeducted = Math.min(kid.coins, curse.penalty)
  const newCoins = kid.coins - coinsDeducted

  const { data: charged, error: chargeError } = await supabase
    .from('kids')
    .update({ coins: newCoins })
    .eq('id', kid.id)
    .eq('coins', kid.coins)
    .select('id')
    .maybeSingle()

  if (chargeError || !charged) {
    return Response.json({ error: 'Balance changed; try again' }, { status: 409, headers: cors() })
  }

  const instanceRes = await supabase.from('curse_instances').insert({
    curse_id: curse.id,
    kid_id: kid.id,
    coins_deducted: coinsDeducted,
    status: 'active',
    refunded: false,
  }).select().single()

  if (instanceRes.error) {
    await supabase.from('kids').update({ coins: kid.coins }).eq('id', kid.id).eq('coins', newCoins)
    return Response.json({ error: instanceRes.error.message }, { status: 500, headers: cors() })
  }

  return Response.json({ instance: instanceRes.data, coins_deducted: coinsDeducted }, { status: 201, headers: cors() })
}
