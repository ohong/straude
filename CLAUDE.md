# Straude — Project Instructions for Claude

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

## Documentation

After completing a chunk of work, update the following docs:

1. **`docs/CHANGELOG.md`** — Summarise what changed. Follow Keep a Changelog format (Added/Changed/Fixed/Removed). Group under `## Unreleased` until a release is cut.
2. **`docs/DECISIONS.md`** — Record major architectural or design decisions that future maintainers would want to reference. Include: the decision, alternatives considered, and why this option was chosen. Date each entry.
3. **`docs/ROADMAP.md`** — Feature requests, ideas, or improvements that came up during the session but are being saved for later. Include enough context for someone to pick it up cold.

## SSR / Hydration

All landing page components marked `"use client"` must produce identical HTML on server and client. Avoid `Math.random()`, `Date.now()`, or any non-deterministic logic in the render path. Use static data or `useEffect` for client-only values.

## Landing Page Voice

The landing page copy follows an "endurance athlete meets Claude Code power user" theme. Language should evoke training, logging sessions, streaks, pace, and discipline — not generic startup/SaaS copy. Avoid words like "flex", "social proof", or internal jargon in user-facing text.
