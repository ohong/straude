# Workstream 1: Activation Funnel Contract

Priority: P1  
Owner: activation instrumentation and test agent  
Estimated size: M  
Depends on: none  
Unblocks: all other workstreams

## Goal

Create one measurable activation contract from landing visit to first session pushed to Straude.

The contract must make it impossible for future work to confuse profile completion, account creation, and first synced usage.

## Current Evidence

- `apps/web/e2e/landing-to-signup.spec.ts` checks landing sections and signup form rendering, but does not cover onboarding or first sync.
- `apps/web/__tests__/flows/signup-to-feed.test.ts` covers mocked signup-to-feed behavior, not the full first-session activation path.
- `apps/web/app/(onboarding)/onboarding/page.tsx` currently sends `onboarding_completed: true` before the Step 3 usage sync moment.
- `packages/cli/src/commands/push.ts` tracks `usage_pushed`, but the web app has no single test-protected activation funnel that ties signup, onboarding, CLI auth, usage submit, and post-sync confirmation together.
- PostHog is already installed and capturing CLI events. Recent project data confirms `cli_first_run`, `cli_authenticated`, `login_completed`, `usage_pushed`, and `usage_push_failed`.
- PostHog does not currently show the planned web activation events. Treat web funnel capture as missing until verified after implementation.

## In Scope

- `apps/web/__tests__/flows/*`
- `apps/web/e2e/*`
- `apps/web/lib/analytics*`
- `apps/web/components/providers/PostHogProvider.tsx`
- `apps/web/app/(landing)/*`
- `apps/web/app/(auth)/*`
- `apps/web/app/(onboarding)/*`
- `apps/web/app/api/usage/status/route.ts`
- `packages/cli/src/commands/login.ts`
- `packages/cli/src/commands/push.ts`
- `packages/cli/src/lib/telemetry.ts`
- Test fixtures and mocks required by this plan

## Out of Scope

- Visual redesign.
- Database schema changes, unless an existing field cannot represent activation state.
- CLI performance changes beyond event emission and test fixtures.

## Activation State Model

Define these states and use them consistently in tests, analytics, and UI copy:

- `anonymous`: user has not authenticated.
- `signed_up`: user authenticated successfully.
- `profile_started`: user supplied minimum identity or explicitly skipped profile details.
- `sync_command_copied`: user copied the canonical sync command from web.
- `cli_first_run`: CLI was invoked on a machine for the first time.
- `login_completed`: CLI received and saved auth credentials.
- `first_usage_submitted`: `/api/usage/submit` accepted at least one usage entry for the user.
- `first_sync_confirmed`: web observed at least one usage row or post generated from usage submit.
- `activated`: first sync confirmed and user was shown the success/profile/feed destination.

Use `activated`, not `onboarding_completed`, as the product success boundary.

## Implementation Instructions

1. Add an activation fixture that can create a new test user, simulate auth callback, and submit one usage entry without relying on third-party OAuth.
2. Add a golden-path Playwright spec:
   - Visit `/`.
   - Click the primary signup CTA.
   - Complete signup through the local test auth path.
   - Reach onboarding.
   - Copy or reveal the canonical `npx straude@latest` command.
   - Simulate one successful CLI usage submit through test-controlled API state.
   - Observe the onboarding success state.
   - Continue to profile or feed and verify the first usage is visible.
3. Add a negative-path spec:
   - Sign up.
   - Skip or leave onboarding before sync.
   - Verify the authenticated app still shows a clear first-sync nudge.
   - Verify the user is not treated as activated.
4. Add an analytics event map in code or docs and make event names stable:
   - Keep existing CLI PostHog events: `cli_first_run`, `cli_authenticated`, `login_completed`, `usage_pushed`, and `usage_push_failed`.
   - Do not rename existing CLI events unless the migration includes aliases, a backfilled insight, and a dashboard update.
   - `landing_primary_cta_clicked`
   - `signup_started`
   - `signup_completed`
   - `onboarding_profile_started`
   - `sync_command_copied`
   - `first_sync_confirmed`
   - `activation_completed`
5. Implement PostHog capture through a small shared analytics wrapper.
   - Web events must no-op safely when analytics consent is absent.
   - If activation metrics must include users without analytics consent, add a server-side, privacy-reviewed PostHog capture path for aggregate lifecycle events instead of bypassing consent in the browser.
   - Every event must include stable properties: `source`, `surface`, `activation_state`, `is_authenticated`, and, where applicable, `cli_version`, `days_pushed`, `pricing_mode`, `backfill_mode`, and timing fields.
   - Do not send prompts, code, file paths, conversation content, or raw usage rows to PostHog.
6. Add PostHog project setup steps after events are shipping.
   - Create actions for the activation funnel only after the events exist in the taxonomy.
   - Build a funnel insight from landing CTA to `activation_completed`.
   - Build a CLI health insight for `usage_pushed` versus `usage_push_failed`.
   - Annotate any event rename or property migration.
7. Add unit tests for activation-state derivation. The tests must cover:
   - Authenticated user with no usage.
   - Authenticated user with usage before onboarding page load.
   - User who copied command but did not submit usage.
   - User with successful usage submit.
8. Make each later workstream consume this shared state instead of inventing local booleans.

## Verification Commands

Run after dependencies are restored:

```bash
bun --cwd apps/web test -- __tests__/flows
bun --cwd apps/web test:e2e -- e2e/landing-to-signup.spec.ts
bun --cwd apps/web test:e2e -- e2e/signup-to-first-session.spec.ts
bun --cwd apps/web typecheck
bun --cwd packages/cli test -- __tests__/commands/login.test.ts __tests__/commands/push.test.ts
bun --cwd packages/cli typecheck
```

If the new E2E spec requires local Supabase, document the exact setup command in the test file header and in this plan's completion notes.

PostHog project verification, run in PostHog SQL or through the PostHog MCP/CLI after deployment:

```sql
SELECT event, count() AS count, max(timestamp) AS last_seen
FROM events
WHERE timestamp >= now() - INTERVAL 7 DAY
  AND event IN (
    'cli_first_run',
    'cli_authenticated',
    'login_completed',
    'usage_pushed',
    'usage_push_failed',
    'landing_primary_cta_clicked',
    'signup_started',
    'signup_completed',
    'onboarding_profile_started',
    'sync_command_copied',
    'first_sync_confirmed',
    'activation_completed',
    '$pageview'
  )
GROUP BY event
ORDER BY event
LIMIT 100
```

## Done Criteria

- There is one testable definition of activation.
- A regression test fails if onboarding completion happens before first sync without an explicit user choice.
- A regression test fails if the first-sync command disappears from the no-data authenticated app state.
- CLI and web analytics use compatible PostHog events for the same funnel.
- PostHog shows recent capture for the implemented funnel events in the target project.
- A PostHog funnel or dashboard exists for signup-to-first-sync iteration, or the PR documents why creation is deferred.
- The new tests can run locally from a fresh checkout after `bun install --frozen-lockfile`.

## Stop Conditions

- Stop and escalate if local test auth cannot create users without relying on production Supabase or real OAuth.
- Stop and escalate if activation requires a new database field and no backward-compatible migration path is obvious.
- Stop and escalate if analytics consent rules prevent emitting the required web events; propose a consent-safe server event alternative.
