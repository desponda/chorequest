import { authenticate, isAuthError, cors } from '@/lib/api-auth'
import { createServiceClient } from '@/lib/supabase/service'

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: cors() })
}

export async function GET(req: Request) {
  const auth = await authenticate(req)
  if (isAuthError(auth)) return auth

  const supabase = createServiceClient()

  const [familyRes, kidsRes] = await Promise.all([
    supabase.from('families').select('id, name, created_at').eq('id', auth.familyId).single(),
    supabase.from('kids').select('id, name, avatar, color, coins, streak, last_completed_date, created_at').eq('family_id', auth.familyId).order('created_at'),
  ])

  return Response.json({
    family: familyRes.data,
    kids: kidsRes.data ?? [],
  }, { headers: cors() })
}
