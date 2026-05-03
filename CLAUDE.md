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
    page.tsx          # Wall display — real-time grid of kid columns (always fullscreen)
    login/page.tsx    # Auth — email/password login and signup
    parent/page.tsx   # Parent dashboard — 4 tabs: Approvals, Quests, Family, Rewards
    kid/[id]/page.tsx # Kid view — PIN lock + quest board + rewards tab
  components/
    kid-column.tsx    # Quest list column used on the wall display
    quest-card.tsx    # Individual quest card with approve/reject controls
    coin-counter.tsx  # Animated coin display
    streak-badge.tsx  # Streak flame badge
    star-field.tsx    # Animated starfield background
  lib/
    supabase/
      client.ts       # Browser Supabase client (createBrowserClient)
      server.ts       # Server Supabase client (createServerClient)
    types.ts          # Shared TypeScript types
    constants.ts      # KID_COLORS, KID_AVATARS, QUEST_ICONS, DEFAULT_QUESTS
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
- Schema is in `supabase/schema.sql` — apply changes via Supabase MCP `apply_migration` tool

## Database Schema (key tables)

| Table | Purpose |
|-------|---------|
| `families` | One per account, created automatically on signup |
| `profiles` | Links auth.users → families |
| `kids` | Kid records with avatar, color, coins, streak, PIN |
| `quests` | Chore templates — daily, assigned to a kid or all kids |
| `completions` | Records of quests completed: pending → approved/rejected |
| `rewards` | Prize catalog managed by parent |
| `redemptions` | Kid reward redemption requests |

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
  - `playwright` (E2E) — **PRs only**, not on direct pushes to main (too slow for routine commits)
- Supabase env vars are set as GitHub Actions secrets (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`)

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL       # https://xdidpzzsfoxijugvrjvc.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY  # Supabase anon key (publishable, safe for browser)
```

Set in Vercel dashboard for production. For local dev: create `.env.local` (gitignored).
