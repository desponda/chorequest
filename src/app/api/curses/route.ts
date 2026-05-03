import { authenticate, isAuthError, cors } from '@/lib/api-auth'
import { createServiceClient } from '@/lib/supabase/service'

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: cors() })
}

export async function GET(req: Request) {
  const auth = await authenticate(req)
  if (isAuthError(auth)) return auth

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('curses')
    .select('*')
    .eq('family_id', auth.familyId)
    .order('created_at')

  if (error) return Response.json({ error: error.message }, { status: 500, headers: cors() })
  return Response.json({ curses: data }, { headers: cors() })
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
    .from('curses')
    .insert({
      family_id: auth.familyId,
      title: body.title,
      icon: body.icon ?? '☠️',
      penalty: Number(body.penalty ?? 10),
    })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500, headers: cors() })
  return Response.json({ curse: data }, { status: 201, headers: cors() })
}
