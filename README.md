# ChoreQuest

Fantasy-themed family chore app. Parents manage quests and rewards; kids complete quests to earn coins.

Built with Next.js 16 App Router, Supabase, and Tailwind CSS.

## Quick Start

```bash
npm install
cp .env.example .env.local  # fill in Supabase keys
npm run dev
```

## Docs

- **[CLAUDE.md](./CLAUDE.md)** — architecture, conventions, environment variables, CI/CD
- **[docs/DESIGN.md](./docs/DESIGN.md)** — design system, color palette, motion principles

## Commands

```bash
npm run dev          # dev server at localhost:3000
npm run build        # production build
npm run lint         # ESLint
npm test             # unit tests (Vitest)
npx playwright test  # E2E tests (requires dev server)
```
