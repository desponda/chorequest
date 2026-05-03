import { authenticate, isAuthError, cors } from '@/lib/api-auth'
import { createServiceClient } from '@/lib/supabase/service'

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: cors() })
}

export async function GET(req: Request) {
  const auth = await authenticate(req)
  if (isAuthError(auth)) return auth

  const { searchParams } = new URL(req.url)
  const activeOnly = searchParams.get('active') !== 'false'

  const supabase = createServiceClient()
  let query = supabase
    .from('quests')
    .select('*')
    .eq('family_id', auth.familyId)
    .order('created_at')

  if (activeOnly) query = query.eq('active', true)

  const { data, error } = await query
  if (error) return Response.json({ error: error.message }, { status: 500, headers: cors() })

  return Response.json({ quests: data }, { headers: cors() })
}

export async function POST(req: Request) {
  const auth = await authenticate(req)
  if (isAuthError(auth)) return auth

  const body = await req.json().catch(() => null)
  if (!body?.title) {
    return Response.json({ error: '`title` is required' }, { status: 400, headers: cors() })
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('quests')
    .insert({
      family_id: auth.familyId,
      title: body.title,
      description: body.description ?? null,
      icon: body.icon ?? '⚔️',
      coins: Number(body.coins ?? 10),
      assigned_to: body.assigned_to ?? null,
      kind: body.kind ?? 'personal',
      frequency: body.frequency ?? 'daily',
      tier: body.tier ?? 'normal',
      slots: Number(body.slots ?? 1),
      active_days: body.active_days ?? null,
      active: true,
    })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500, headers: cors() })

  return Response.json({ quest: data }, { status: 201, headers: cors() })
}
