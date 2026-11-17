# Local Development Environment

Run Straude locally without production Supabase credentials.

This repo now supports a local Supabase stack backed by Docker plus a generated
`apps/web/.env.local`.

The root [`.env.example`](../.env.example) is the canonical list of repo-wide
secrets and hosted integrations. For local Supabase workflows, `bun run local:env`
writes the managed keys directly into `apps/web/.env.local`.

## Prerequisites

- Docker Desktop running
- Bun installed

You do **not** need a hosted Supabase project for normal local UI work.

## Verify private workspace sharing and weekly reports

Use the disposable local stack. These tests refuse non-loopback app/database URLs, create fictional accounts in two workspaces, and remove their own fixtures. They temporarily backdate source consent using the local admin fixture so a historical week can be exercised without waiting a day; the product enrollment API does not permit this.

```bash
bun run local:up
bun run local:env
bun run --cwd packages/cli build
cd apps/web
set -a
. ./.env.local
set +a
POSTHOG_API_KEY= NEXT_PUBLIC_POSTHOG_KEY= NEXT_PUBLIC_APP_URL=http://localhost:3099 \
  PLAYWRIGHT_USE_DEV_SERVER=1 bun run test:e2e e2e/private-workspaces.spec.ts --reporter=list
```

The browser test covers personal recap → workspace creation → email-bound invitation acceptance → sharing preview → built CLI enrollment/status → setup/weekly report → CSV → removal. It checks direct database/RPC access, revoked invitations, exclusion of personal history and public publication, no-data/zero/stale states, retries, declined token regressions, keyboard forms, and a narrow layout. A separate test runs actual native Codex log collection through the built CLI and private API. CI builds that CLI before browser tests and runs both tests.

The native collector needs online pricing access. Some intercepted cloud networks cannot be trusted by the bundled collector's native TLS implementation. Do not disable certificate checks. For independent local UI/API verification only, set `STRAUDE_E2E_SKIP_NETWORK_COLLECTOR=1`; Playwright explicitly reports the native collection test skipped. Run the default command or hosted CI before claiming that boundary passed.

Sanitized screenshots, CSV and CLI receipts are saved under `apps/web/test-results/private-workspaces-evidence/` and uploaded by CI as `private-workspace-walkthrough`. General Playwright traces can contain authentication material and are not included in that artifact.

For a manual walkthrough, use two local accounts with private profiles. Review `/recap`, create a workspace at `/workspaces`, generate an invitation link for the other account, and accept it after reading the sharing disclosure. On an exclusively work-only device or OS account with the compatible CLI installed, run `straude login`, then `straude workspace connect <workspace-id> --work-only`. Sharing starts at the next UTC midnight. Run `straude` after that date and `straude workspace status` to confirm receipt. Refresh the workspace, compare the weekly figures and CSV, then remove the member and confirm both access and further sync fail. Past contributed totals remain. The published older CLI may lack these commands; install a built candidate for local verification.

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
  Creates demo users and content using `SUPABASE_SECRET_KEY` (`sb_secret_xxx`).
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
