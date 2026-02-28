# Straude — Project Instructions for Claude

## North Star Metric

**Cumulative spend logged** — total `cost_usd` across all users in `daily_usage`. This is the single most important metric for the project. Supabase project ID: `kanfzeovbmusnhmbnhit`.

```sql
SELECT
  COUNT(DISTINCT user_id) AS total_users,
  SUM(cost_usd) AS total_spend_usd,
  SUM(total_tokens) AS total_tokens,
  SUM(session_count) AS total_sessions
FROM daily_usage;
```

## Stack

- **Monorepo**: Turborepo with Bun workspaces
- **Web**: Next.js 16 (App Router, Turbopack), React 19, Tailwind CSS v4
- **CLI**: TypeScript, published as `straude` on npm
- **Database**: Supabase (Postgres + Auth + Storage)
- **Testing**: Vitest (unit), Playwright (e2e)

## Conventions

- Use `bun` for package management (see global CLAUDE.md for detection rules)
- Prefer editing existing files over creating new ones
- Landing page components live in `apps/web/components/landing/`
- App (authenticated) components live in `apps/web/components/app/`
- Shared types in `apps/web/types/index.ts`
- CSS theme variables defined in `apps/web/app/globals.css` via `@theme inline`
- Accent color is `#DF561F` — used only for interactive elements and emphasis
- **Next.js 16 uses `proxy.ts`**, not `middleware.ts`. Never create a middleware.ts file.

## Supabase Keys

This project uses the **new Supabase key model** (publishable + secret), not the legacy anon/service_role keys.

- **Client-side**: `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (format: `sb_publishable_xxx`)
- **Server-side**: `SUPABASE_SECRET_KEY` (format: `sb_secret_xxx`)
- Never reference `SUPABASE_ANON_KEY` or `SUPABASE_SERVICE_ROLE_KEY` — those are legacy.

## Documentation

After completing a chunk of work, update the following docs:

1. **`docs/CHANGELOG.md`** — Summarise what changed. Follow Keep a Changelog format (Added/Changed/Fixed/Removed). Group under `## Unreleased` until a release is cut.
2. **`docs/DECISIONS.md`** — Record major architectural or design decisions that future maintainers would want to reference. Include: the decision, alternatives considered, and why this option was chosen. Date each entry.
3. **`docs/ROADMAP.md`** — Feature requests, ideas, or improvements that came up during the session but are being saved for later. Include enough context for someone to pick it up cold.

## Scope

Only change what's directly requested. Don't add validation, limits, or constraints not asked for. Don't refactor adjacent code. Don't replace custom components with simpler alternatives.

## Security

Never hardcode API keys or secrets. Always use env vars via `.env.local`. When adding a new env var, also add it to `.env.example`.

## Design System

Only use colors from `globals.css` `@theme` block. No purple gradients, glow effects, or styles not in the codebase. Prefer CSS scaling over cropping for images. Check the `frontend-design` skill before major UI work.

## SSR / Hydration

All landing page components marked `"use client"` must produce identical HTML on server and client. Avoid `Math.random()`, `Date.now()`, or any non-deterministic logic in the render path. Use static data or `useEffect` for client-only values.

## Landing Page Voice

The landing page copy follows an "endurance athlete meets Claude Code power user" theme. Language should evoke training, logging sessions, streaks, pace, and discipline — not generic startup/SaaS copy. Avoid words like "flex", "social proof", or internal jargon in user-facing text.
