@AGENTS.md

# ChoreQuest — Claude Code Guide

## New Machine Setup

Enable these plugins in Claude Code settings (`claude settings` → Plugins), then authenticate:

| Plugin | Purpose | Auth |
|--------|---------|------|
| `supabase@claude-plugins-official` | Run migrations, execute SQL, manage schema | `claude mcp auth supabase` after enabling |
| `vercel@claude-plugins-official` | Check deployments, logs, manage project | OAuth via browser prompt |
| `cloudflare@claude-plugins-official` | DNS, Workers, domain management | OAuth via browser prompt |
| `frontend-design@claude-plugins-official` | UI design guidance | No auth needed |
| `superpowers@claude-plugins-official` | Core skill runner (required) | No auth needed |

`.mcp.json` in the repo root already points Claude at the Supabase MCP endpoint — just auth and it works.

## Project Overview

ChoreQuest is a fantasy-themed family chore app. Parents manage quests and rewards; kids complete quests to earn coins. Built with Next.js 16 App Router, Supabase, and Tailwind CSS.

## Architecture

```
src/
  app/
    page.tsx                        # Marketing landing page (public, unauthenticated visitors)
    display/page.tsx                # Wall display — real-time grid of kid columns (always fullscreen)
    blog/page.tsx                   # Blog listing — published posts, SEO metadata (server component)
    blog/[slug]/page.tsx            # Blog post — markdown body, sources, Open Graph (server component)
    login/page.tsx                  # Auth — email/password login and signup
    parent/page.tsx                 # Parent dashboard — 4 tabs: Approvals, Quests, Family, Rewards
    kid/[id]/page.tsx               # Kid view — PIN lock + quest board + rewards tab
    join/[token]/page.tsx           # Public family invite page — kid picker → PIN screen
    auth/callback/route.ts          # Supabase OAuth callback (validates next param)
    api/
      kid/[id]/verify-pin/route.ts  # Server-side kid PIN verification (no PIN in browser)
      parent/verify-pin/route.ts    # Server-side parent PIN verification (requires auth session)
      family/route.ts               # External REST API — family info (no api_key exposed)
      kids/route.ts                 # External REST API — kids list (no pin exposed)
      quests/route.ts               # External REST API — quests CRUD
      rewards/route.ts              # External REST API — rewards CRUD
  components/
    kid-column.tsx    # Quest list column used on the wall display
    quest-card.tsx    # Individual quest card with tier badge + approve/reject controls
    coin-counter.tsx  # Animated coin display
    streak-badge.tsx  # Streak flame badge
    star-field.tsx    # Animated starfield background
  lib/
    supabase/
      client.ts       # Browser Supabase client (createBrowserClient)
      server.ts       # Server Supabase client (createServerClient)
      service.ts      # Service role client — used only in API routes, bypasses RLS
    types.ts          # Shared TypeScript types
    constants.ts      # KID_COLORS, KID_AVATARS, QUEST_ICONS, DEFAULT_QUESTS, TIER_CONFIG
    api-auth.ts       # External API key auth helper + CORS headers
    utils.ts          # Tailwind cn() helper
  proxy.ts            # Next.js 16 middleware (replaces middleware.ts) — auth redirect
```

## Next.js 16 Breaking Changes (READ BEFORE EDITING)

- **Middleware file is `src/proxy.ts`**, not `src/middleware.ts`
- **Route params are a Promise**: `params: Promise<{ id: string }>` — unwrap with `use(params)`
- Check `node_modules/next/dist/docs/` for the latest API reference before writing any code

## Supabase

- **Project ID**: `xdidpzzsfoxijugvrjvc` (region: us-east-1)
- **RLS is enabled on all tables** — queries run as the authenticated user's family scope
- **Realtime** is enabled on `completions` and `kids` tables
- `get_user_family_id()` is a security-definer helper function used in all RLS policies
- Auth **Site URL** and **Redirect URLs** are set to `https://chorequest.dresponda.com`
- Schema is in `supabase/schema.sql`

### Migration Rules — READ BEFORE TOUCHING THE DB

> **NEVER apply migrations manually via `apply_migration` (MCP) or `execute_sql`.**

Always use CI/CD:
1. Write the migration file in `supabase/migrations/` with a timestamp prefix (e.g. `YYYYMMDDHHMMSS_description.sql`)
2. Commit and push via PR → CI runs `supabase db push` which applies only unapplied migrations and records the **filename timestamp** as the version

**Why**: `apply_migration` via MCP stamps the version with the current clock time, not the filename prefix. This causes `supabase db push` to fail in CI with *"Remote migration versions not found in local migrations directory"* — breaking every subsequent deploy until the files are manually renamed to match. We have been burned by this repeatedly.

## Database Schema (key tables)

| Table | Purpose |
|-------|---------|
| `families` | One per account — has `invite_token` (public join link) and `api_key` (external API auth) |
| `profiles` | Links auth.users → families |
| `kids` | Kid records with avatar, color, coins, streak, PIN (pin never sent to browser) |
| `quests` | Chore templates — `frequency` (daily/once), `tier` (normal/heroic/legendary/epic) |
| `completions` | Records of quests completed: pending → approved/rejected |
| `rewards` | Prize catalog managed by parent |
| `redemptions` | Kid reward redemption requests |
| `posts` | Blog articles — `slug`, `body` (markdown), `sources` (jsonb), `published` flag; public SELECT on published=true |

## Security Model

- **Kid PIN**: Never fetched to the browser. Verification goes through `/api/kid/[id]/verify-pin` (service client, server-side) and issues a signed, HttpOnly session required by kid data and mutation routes. Client enforces 5-attempt lockout.
- **Parent PIN**: Not stored in React state — only `has_parent_pin: boolean` is kept. Verification goes through `/api/parent/verify-pin` (requires active auth session).
- **Public routes**: `/login`, `/api/*`, `/join/*` — no Supabase session required. All others redirect to login.
- **RLS**: All tables use `get_user_family_id()` — authenticated users only see their own family's data.
- **External API**: Bearer `api_key` auth. Never returns `pin` or `api_key` in responses. CORS restricted to `CORS_ORIGIN` env var (defaults to `https://chorequest.dresponda.com` in production).
- **`get_family_by_invite_token(uuid)`**: Anon-callable RPC that returns only id/name/kids without PINs.

## Design System

- **Background**: `bg-quest-void` (deep dark with azure/mystic radial gradients)
- **Font heading**: Cinzel (`font-heading`) — used for titles, buttons, UI chrome
- **Font body**: Nunito (`font-sans`) — used for content text
- **Colors**: `cq-gold` (#fbbf24), `cq-azure` (#38bdf8), `cq-mystic` (#a78bfa), `cq-ember` (#fb923c), `cq-forest` (#4ade80)
- **Glass effect**: `.glass` / `.glass-strong` utility classes
- **Kid themes**: `azure` (blue) and `mystic` (purple) — defined in `KID_COLORS` constant
- **Layout rule**: Wall display is always fullscreen. Parent and kid pages use `max-w-2xl` / `max-w-md` centered containers — never stretch UI to full viewport width

## Key Conventions

- All pages are `'use client'` with `export const dynamic = 'force-dynamic'`
- Supabase client is created once via `useState(createClient)` — not recreated on re-renders
- Real-time subscriptions are set up in `useEffect` and cleaned up on unmount
- Toasts use `sonner` — imported from `@/components/ui/sonner` (Toaster) and `sonner` (toast)
- Inline styles are used alongside Tailwind for dynamic/theme-specific values
- **Never use `select('*')` on tables with sensitive columns** — always enumerate columns explicitly

## Testing Strategy (Testing Pyramid)

The project follows the testing pyramid — unit tests are fastest and cheapest; E2E is reserved for critical paths.

| Layer | Tool | When to run | What to test |
|-------|------|-------------|--------------|
| Unit | Vitest | Every commit (fast, <5s) | Pure functions, utilities, constants, type guards |
| Integration | Vitest + MSW | Every PR (medium, ~30s) | API route handlers, auth logic, data transforms |
| E2E | Playwright | PR + main only (slow, ~2min) | Critical user journeys: login, quest complete, approval |

- Unit/integration tests live in `src/**/__tests__/` or `*.test.ts` files
- Playwright tests live in `e2e/`
- CI runs unit+integration on every push; Playwright only on PRs and pushes to main

## Commands

```bash
npm run dev          # Start dev server at localhost:3000
npm run build        # Production build
npm run lint         # ESLint
npm test             # Unit tests (Vitest, ~200ms, no env vars needed)
npm run test:watch   # Unit tests in watch mode
npm run test:coverage  # Unit tests with coverage report
npx playwright test  # E2E tests (requires dev server + Supabase env vars)
vercel --prod        # Deploy to production (CI/CD via GitHub is preferred)
```

## CI/CD

- GitHub repo: `https://github.com/desponda/chorequest`
- Vercel project: connected to GitHub — pushes to `main` auto-deploy to production
- Preview deploys: every branch/PR gets a unique Vercel URL
- **CI jobs** (`.github/workflows/ci.yml`):
  - `typecheck` + `lint` + `unit tests` — run on every push to main and every PR
  - `playwright` (E2E) — **manual trigger only** (`workflow_dispatch`)
- **DB migrate** (`.github/workflows/db-migrate.yml`):
  - Runs on push to main when any file under `supabase/migrations/**` changes, or via manual trigger
  - Calls `supabase link` + `supabase db push` — applies only unapplied migrations (idempotent)
  - Requires two GH Actions secrets: `SUPABASE_ACCESS_TOKEN` (personal access token from supabase.com) and `SUPABASE_DB_PASSWORD` (project DB password)
- Supabase env vars as GitHub Actions secrets: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL       # https://xdidpzzsfoxijugvrjvc.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY  # Supabase anon key (publishable, safe for browser)
SUPABASE_SERVICE_ROLE_KEY      # Service role key — server-side only (API routes, verify-pin endpoints)
KID_SESSION_SECRET             # Optional HMAC secret for kid sessions; falls back to service role key
NEXT_PUBLIC_SENTRY_DSN         # Sentry DSN for error tracking
SENTRY_ORG                     # Sentry org slug (build-time source map upload)
SENTRY_PROJECT                 # Sentry project slug
CORS_ORIGIN                    # Allowed CORS origin for external API (default: https://chorequest.dresponda.com)
```

Set in Vercel dashboard for production. For local dev: create `.env.local` (gitignored).

## PR Checklist

Every PR should:
- [ ] Update `CLAUDE.md` if architecture, security model, or conventions change
- [ ] Update `supabase/schema.sql` for any DB migrations
- [ ] Run `npm run build` locally before pushing
- [ ] Add unit/integration tests for new utility functions or API routes
