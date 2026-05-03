import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(req: NextRequest) {
  // Require an active Supabase session (parent must be logged in)
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  if (!body?.pin || typeof body.pin !== 'string' || !/^\d{4}$/.test(body.pin)) {
    return Response.json({ error: 'Invalid request' }, { status: 400 })
  }

  const svc = createServiceClient()
  const { data: profile } = await svc
    .from('profiles')
    .select('family_id')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  const { data: family } = await svc
    .from('families')
    .select('parent_pin')
    .eq('id', profile.family_id)
    .single()

  if (!family) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  const success = family.parent_pin === body.pin
  return Response.json({ success }, { status: success ? 200 : 401 })
}
