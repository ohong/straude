# Developer Setup Guide

## Prerequisites

- **Bun** >= 1.3.3 (pinned in `package.json` via `packageManager` field)
- **Node.js** >= 18 (for CLI package)
- **Git**
- Docker Desktop (for local Supabase)
- Optional hosted **Supabase** project (only if you explicitly want to connect to a remote backend)

## Repository Structure

```
straude/
├── apps/
│   └── web/          # Next.js 16 app (App Router, Turbopack)
├── packages/
│   └── cli/          # CLI published as `straude` on npm
├── docs/             # Project documentation
├── supabase/         # Migrations and Supabase config
├── turbo.json        # Turborepo task config
└── package.json      # Bun workspaces root
```

Turborepo manages the monorepo with Bun workspaces (`apps/*`, `packages/*`).

## Environment Setup

1. Clone the repository and install dependencies:

```bash
git clone <repo-url> && cd straude
bun install
```

2. Choose your backend mode:

### Option A: Local Supabase (recommended)

```bash
bun run local:setup
```

This starts Supabase locally, writes `apps/web/.env.local`, and seeds demo
data. See [docs/LOCAL_DEV.md](./LOCAL_DEV.md) for the full workflow.

### Option B: Hosted Supabase

Copy the environment template:

```bash
cp .env.example apps/web/.env.local
```

3. Fill in the required environment variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes | Supabase publishable key (`sb_publishable_xxx`) |
| `SUPABASE_SECRET_KEY` | Yes | Supabase secret key (`sb_secret_xxx`) |
| `CLI_JWT_SECRET` | Yes | Secret for signing CLI auth tokens |
| `NEXT_PUBLIC_APP_URL` | No | App URL, defaults to `https://straude.com` |
| `RESEND_API_KEY` | No | Resend API key for emails |
| `RESEND_FROM_EMAIL` | No | Sender email, defaults to `notifications@straude.com` |
| `UNSUBSCRIBE_SECRET` | No | Signs email unsubscribe tokens |
| `ANTHROPIC_API_KEY` | No | Claude API key for AI caption generation |
| `FAL_KEY` | No | Fal AI key for image generation |
| `CRON_SECRET` | No | Authenticates Vercel cron job requests |
| `ADMIN_USER_IDS` | No | Comma-separated Supabase user UUIDs for admin access |

**Important:** This project uses the **new Supabase key model** (publishable + secret), not the legacy `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY`. See the CLAUDE.md Supabase Keys section for details.

## Database Setup

### Local Supabase

```bash
bun run local:up
bun run local:env
bun run local:seed
```

Reset everything from migrations:

```bash
bun run local:reset
```

### Hosted Supabase

Apply Supabase migrations to set up the schema:

```bash
supabase db push
```

Or if using the Supabase dashboard, run the migration SQL files from `supabase/migrations/` in order.

Key tables: `users`, `daily_usage`, `device_usage`, `posts`, `comments`, `kudos`, `follows`, `notifications`, `direct_messages`, `cli_auth_codes`, `achievements`, `prompt_submissions`, `comment_reactions`.

Storage buckets:

| Bucket | Purpose | Max file size |
|--------|---------|---------------|
| `post-images` | Post image uploads | 20 MB |
| `dm-attachments` | DM file attachments | 10 MB |

## Running Locally

### Web App

```bash
bun run dev
```

This runs `turbo dev`, which starts the Next.js dev server with Turbopack at `http://localhost:3000`.

For local Supabase development without Portless:

```bash
bun run dev:local
```

### CLI (development)

```bash
cd packages/cli
bun run build       # Compile TypeScript to dist/
node dist/index.js  # Run locally
```

Or link for local testing:

```bash
cd packages/cli
bun link
straude --version
```

## Testing

### Unit Tests (web)

```bash
cd apps/web
bun run test
```

Uses Vitest with jsdom environment. Test files live in `apps/web/__tests__/` and alongside source files.

### Unit Tests (CLI)

```bash
cd packages/cli
bun run test
```

Uses Vitest. Test files in `packages/cli/__tests__/` and `packages/cli/src/`.

### End-to-End Tests

```bash
cd apps/web
bunx playwright install chromium   # First time only
bun run test:e2e
```

Uses Playwright with Chromium. E2E specs live in `apps/web/e2e/`. Requires the dev server running (Playwright auto-starts it via `bun run dev`).

### Type Checking

```bash
cd apps/web
bun run typecheck    # runs tsc --noEmit -p tsconfig.check.json
```

### All at once via Turbo

```bash
bun run build        # Build all packages
```

## CI Pipeline

GitHub Actions (`.github/workflows/ci.yml`) runs on push and PR:

1. Install dependencies (`bun install`)
2. Typecheck (`apps/web`)
3. Build (with placeholder Supabase env vars)
4. Unit tests (`apps/web` + `packages/cli`)
5. Playwright E2E tests (`apps/web`)

CI uses `bun@latest` and placeholder Supabase credentials for build/test (no real DB connection needed).

## Project Conventions

- **Package manager**: Always use `bun` (never npm/yarn/pnpm)
- **Proxy, not middleware**: Next.js 16 uses `proxy.ts`, not `middleware.ts` — never create a `middleware.ts` file
- **Landing components**: `apps/web/components/landing/`
- **App components**: `apps/web/components/app/`
- **Shared types**: `apps/web/types/index.ts`
- **CSS variables**: Defined in `apps/web/app/globals.css` via `@theme inline`
- **Accent color**: `#DF561F` — used only for interactive elements and emphasis
- **Server-side env vars**: Never use `NEXT_PUBLIC_` prefix for server-only values
- **Security**: Never hardcode secrets; always use env vars via `.env.local`

## Editor Setup

The project includes a `.claude/settings.json` that runs `tsc --noEmit` as a post-edit hook. If using Claude Code, type errors surface immediately after file edits.

Pre-push hooks are available in `.githooks/pre-push`. Enable with:

```bash
git config core.hooksPath .githooks
```
