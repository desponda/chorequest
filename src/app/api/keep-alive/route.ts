import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const SCHEDULER_USER_AGENTS = ['chorequest-keepalive/1.0']

function isAuthorized(request: Request): boolean {
  const configuredToken = process.env.KEEPALIVE_TOKEN
  if (configuredToken) {
    return request.headers.get('authorization') === `Bearer ${configuredToken}`
  }

  const userAgent = request.headers.get('user-agent') ?? ''
  return userAgent.startsWith('vercel-cron/') || SCHEDULER_USER_AGENTS.includes(userAgent)
}

/**
 * Performs a tiny, read-only query so scheduled traffic counts as real
 * database activity. It intentionally uses the anon key and a public table;
 * the service-role key never leaves the server and is not needed here.
 */
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ ok: false }, { status: 503 })
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { error } = await supabase
    .from('posts')
    .select('id')
    .eq('published', true)
    .limit(1)

  if (error) {
    return NextResponse.json({ ok: false }, { status: 503 })
  }

  return NextResponse.json(
    { ok: true },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
