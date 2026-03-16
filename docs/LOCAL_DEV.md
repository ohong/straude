# Local Development Environment

Run Straude locally without production Supabase credentials.

This repo now supports a local Supabase stack backed by Docker plus a generated
`apps/web/.env.local`.

The root [`.env.example`](../.env.example) is
still the canonical list of repo-wide secrets and hosted integrations. The
app-level [`apps/web/.env.local.example`](../apps/web/.env.local.example)
exists only to document the web app's local Supabase workflow and the managed
keys that `bun run local:env` writes.

## Prerequisites

- Docker Desktop running
- Bun installed

You do **not** need a hosted Supabase project for normal local UI work.

## Quick Start

From the repo root:

```bash
bun install
bun run local:setup
bun run dev:local
```

What this does:

1. `bun run local:up`
   Starts Supabase locally with Docker.
2. `bun run local:env`
   Writes `apps/web/.env.local` from the running local stack.
3. `bun run local:seed`
   Seeds demo users, usage rows, posts, and storage buckets.
4. `bun run dev:local`
   Starts the Next.js app without requiring Portless.

## Useful Commands

```bash
bun run local:up
bun run local:down
bun run local:reset
bun run local:env
bun run local:seed
bun run dev:local
```

### Command Details

- `local:up`
  Starts local Supabase via `bunx supabase start`.
- `local:down`
  Stops the local containers.
- `local:reset`
  Rebuilds the local DB from migrations and runs `supabase/seed.sql`.
- `local:env`
  Generates `apps/web/.env.local` with:
  - local Supabase URL
  - local publishable key
  - local secret key
  - local app URL
  - local fallback secrets for CLI auth, cron, and unsubscribe
- `local:seed`
  Creates demo users and content using the local service key.
- `dev:local`
  Starts the web app against the generated local env.

## Demo Accounts

After `bun run local:seed`:

- `mark@local.straude` / `password123`
- `alice@local.straude` / `password123`

Useful URLs:

- `http://localhost:3000/u/mark`
- `http://localhost:3000/u/alice`

## Generated Files

### `apps/web/.env.local`

This file is written by `bun run local:env`.

If it already exists, the generator updates the managed keys and preserves
unknown custom keys you may have added manually.

### `supabase/seed.sql`

This file provisions local storage buckets that production normally gets outside
the migration path:

- `avatars`
- `post-images`
- `dm-attachments` (private, to match production expectations for direct-message attachments)

## Missing Env Behavior

When Supabase env is missing in development:

- page requests are redirected to `/dev/local-env`
- API requests return `503` with setup steps

This avoids the previous hard crash from `createServerClient(...)` before the
developer even had a chance to finish setup.

## Troubleshooting

### Docker daemon not running

If `bun run local:up` fails with a Docker daemon error:

1. Launch Docker Desktop
2. Wait for Docker to finish starting
3. Retry `bun run local:up`

### App still using hosted credentials

Delete `apps/web/.env.local` and rerun:

```bash
bun run local:env
```

### Empty app after startup

Rerun:

```bash
bun run local:seed
```

### Full reset

```bash
bun run local:reset
bun run local:env
bun run local:seed
```
