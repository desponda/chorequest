import { authenticate, isAuthError, cors } from '@/lib/api-auth'
import { createServiceClient } from '@/lib/supabase/service'

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: cors() })
}

export async function GET(req: Request) {
  const auth = await authenticate(req)
  if (isAuthError(auth)) return auth

  const supabase = createServiceClient()
  const today = new Date().toISOString().split('T')[0]

  const [kidsRes, completionsRes] = await Promise.all([
    supabase.from('kids').select('*').eq('family_id', auth.familyId).order('created_at'),
    supabase.from('completions')
      .select('kid_id, status, coins_awarded, quest:quests(title, coins)')
      .eq('date', today)
      .in('kid_id', (await supabase.from('kids').select('id').eq('family_id', auth.familyId)).data?.map(k => k.id) ?? []),
  ])

  const kids = (kidsRes.data ?? []).map(kid => ({
    ...kid,
    today: {
      completions: (completionsRes.data ?? []).filter(c => c.kid_id === kid.id),
    },
  }))

  return Response.json({ kids }, { headers: cors() })
}
