import { authenticate, isAuthError, cors } from '@/lib/api-auth'
import { createServiceClient } from '@/lib/supabase/service'
import { isDateKey, questDateStringForZone } from '@/lib/utils'

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: cors() })
}

export async function GET(req: Request) {
  const auth = await authenticate(req)
  if (isAuthError(auth)) return auth

  const supabase = createServiceClient()
  const { searchParams } = new URL(req.url)

  // Allow caller to supply date explicitly (YYYY-MM-DD) to handle timezone edge cases
  let today = searchParams.get('date') ?? null
  if (today && !isDateKey(today)) {
    return Response.json({ error: '`date` must be YYYY-MM-DD' }, { status: 400, headers: cors() })
  }
  if (!today) {
    const { data: fam } = await supabase.from('families').select('daily_reset_hour, timezone').eq('id', auth.familyId).single()
    try {
      today = questDateStringForZone(fam?.daily_reset_hour ?? 0, fam?.timezone ?? 'UTC')
    } catch {
      return Response.json({ error: 'Family timezone is invalid' }, { status: 500, headers: cors() })
    }
  }

  const [kidsRes, completionsRes] = await Promise.all([
    supabase.from('kids').select('id, name, avatar, color, coins, streak, last_completed_date, created_at').eq('family_id', auth.familyId).order('created_at'),
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
