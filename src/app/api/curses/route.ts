import { authenticate, isAuthError, cors } from '@/lib/api-auth'
import { createServiceClient } from '@/lib/supabase/service'
import type { Plan } from '@/lib/types'
import { PLAN_LIMITS } from '@/lib/plans'
import { boundedInteger, nonEmptyString } from '@/lib/validation'

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
    .eq('archived', false)
    .order('created_at')

  if (error) return Response.json({ error: error.message }, { status: 500, headers: cors() })
  return Response.json({ curses: data }, { headers: cors() })
}

export async function POST(req: Request) {
  const auth = await authenticate(req)
  if (isAuthError(auth)) return auth

  const body = await req.json().catch(() => null)
  const title = nonEmptyString(body?.title)
  const icon = body?.icon === undefined ? '☠️' : nonEmptyString(body.icon)
  const penalty = boundedInteger(body?.penalty, { defaultValue: 10, min: 1, max: 1_000_000 })
  if (!title) {
    return Response.json({ error: '`title` is required' }, { status: 400, headers: cors() })
  }
  if (!icon) return Response.json({ error: '`icon` must be non-empty text' }, { status: 400, headers: cors() })
  if (penalty === null) return Response.json({ error: '`penalty` must be a positive integer' }, { status: 400, headers: cors() })

  const supabase = createServiceClient()

  const { data: familyData } = await supabase.from('families').select('plan').eq('id', auth.familyId).single()
  const plan = ((familyData?.plan ?? 'free') as Plan)
  if (!PLAN_LIMITS[plan].curses) {
    return Response.json({ error: 'Curses require Family plan or higher' }, { status: 402, headers: cors() })
  }

  const { data, error } = await supabase
    .from('curses')
    .insert({
      family_id: auth.familyId,
      title,
      icon,
      penalty,
      archived: false,
    })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500, headers: cors() })
  return Response.json({ curse: data }, { status: 201, headers: cors() })
}
