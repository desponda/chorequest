import { createBrowserClient } from '@supabase/ssr'

// Fallback placeholders allow `next build` to succeed before .env.local is configured.
// Supabase calls will fail gracefully (no user session) until real values are provided.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-anon-key'
  )
}
