# Workstream 6: CLI First-Run Snappiness

Priority: P1  
Owner: CLI activation and performance agent  
Estimated size: M  
Depends on: Workstream 1 activation event names

## Goal

Make `npx straude@latest` feel fast and successful on the first run.

The CLI should authenticate, sync the smallest useful amount of data, show an immediate success result, and defer heavier repair, backfill, dashboard, and telemetry work until after the activation moment.

## Current Evidence

- `packages/cli/src/index.ts` runs `pushCommand` when no command is provided.
- `packages/cli/src/commands/push.ts` logs in first if no config exists, then continues into sync.
- `resolvePushDateRange()` prioritizes ccusage v20 migration backfill before explicit `--days`; tests currently expect `pushCommand({ days: "3" })` to run a 30-day migration backfill when the migration marker is missing.
- `packages/cli/src/lib/ccusage.ts` uses `CCUSAGE_PRICING_MODE = "online"` and invokes `ccusage daily ... --no-offline`.
- `apps/web/app/api/usage/submit/route.ts` rejects collector metadata unless `pricing_mode` is `"online"`.
- After submit, `pushCommand` fetches `/api/cli/dashboard` and renders `PushSummary`.
- `packages/cli/src/index.ts` allows up to 500 ms for telemetry shutdown before process exit.
- PostHog CLI telemetry is active in the project. Recent events include `cli_first_run`, `cli_authenticated`, `login_completed`, `usage_pushed`, and `usage_push_failed`.
- Prior benchmark context indicates offline `ccusage` collection was much faster in an earlier implementation. Treat this as a performance hypothesis and re-benchmark against the current code before changing production behavior.

## In Scope

- `packages/cli/src/index.ts`
- `packages/cli/src/commands/login.ts`
- `packages/cli/src/commands/push.ts`
- `packages/cli/src/commands/status.ts`
- `packages/cli/src/lib/ccusage.ts`
- `packages/cli/src/lib/api.ts`
- `packages/cli/src/lib/telemetry.ts`
- `packages/cli/__tests__/commands/*`
- `packages/cli/__tests__/lib/*`
- `apps/web/app/api/usage/submit/route.ts` only if collector metadata acceptance changes
- Benchmark script or fixture for CLI first-run timing

## Out of Scope

- Web onboarding layout changes.
- Feed/profile UI.
- New billing or pricing semantics.

## Implementation Instructions

1. Define first-run timing budget.
   - Measure a fresh unauthenticated `npx straude@latest` path with auth mocked or fixture-controlled.
   - Measure a post-auth first sync with local ccusage fixture data.
   - Record collection time, submit time, dashboard time, render time, and telemetry shutdown time separately.
   - Add these timings to `usage_pushed` and `usage_push_failed` PostHog properties where they are safe and low-cardinality: `collection_ms`, `submit_ms`, `dashboard_ms`, `total_ms`, and `telemetry_shutdown_ms`.
2. Make first sync small by default.
   - The first successful run should sync the latest useful day or a small bounded window.
   - Do not run a 30-day migration backfill before first success unless the user explicitly requests repair/backfill.
   - Respect explicit `--days` unless there is a clearly documented safety reason not to.
   - Add a follow-up message after first success for optional historical backfill, such as `straude push --days 30` or a dedicated repair command.
3. Benchmark online versus offline `ccusage` pricing.
   - Compare current `--no-offline` behavior with offline-first collection on representative fixture data.
   - If offline-first is materially faster and accurate enough for activation, implement one of:
     - offline-first with online fallback for missing pricing;
     - explicit fast mode;
     - background online correction after initial success.
   - If accepting offline collector metadata, update `apps/web/app/api/usage/submit/route.ts` deliberately and add server tests.
   - Do not silently weaken cost trust without labeling or correction behavior.
4. Show success before dashboard enrichment.
   - Use `/api/usage/submit` response data to print immediate success, totals, and first post URL.
   - Fetch `/api/cli/dashboard` after success only if it is fast, timeboxed, or explicitly requested through `straude status`.
   - If dashboard fetch fails, the first sync must still feel successful.
5. Tighten telemetry exit behavior.
   - Do not let telemetry shutdown make a successful command feel delayed.
   - Lower the timeout or make shutdown best-effort after visible success.
   - Keep failure telemetry useful, but never block critical error output.
6. Preserve and enrich PostHog telemetry.
   - Keep existing event names: `cli_first_run`, `cli_authenticated`, `login_completed`, `usage_pushed`, and `usage_push_failed`.
   - Add properties instead of renaming events.
   - Include `first_run`, `auth_flow_started`, `backfill_mode`, `pricing_mode`, `ccusage_version`, `dashboard_rendered`, and `dashboard_timed_out` where applicable.
   - Keep path scrubbing and opt-out behavior intact.
   - Verify event volume and properties in PostHog after release.
7. Improve first-run copy.
   - During login, explain that the CLI will continue into first sync after browser confirmation.
   - After sync, show the web destination and one next action.
   - Avoid dumping implementation detail before success.
8. Update tests.
   - Replace tests that expect `--days` to be overridden by migration backfill.
   - Add tests for first-run quick sync, explicit backfill, dashboard timeout, telemetry timeout, and collector metadata mode.

## Verification Commands

```bash
bun --cwd packages/cli test -- __tests__/commands/login.test.ts __tests__/commands/push.test.ts __tests__/commands/status.test.ts
bun --cwd packages/cli test -- __tests__/lib
bun --cwd packages/cli typecheck
bun --cwd packages/cli build
```

If server metadata acceptance changes:

```bash
bun --cwd apps/web test -- app/api/usage/submit
bun --cwd apps/web typecheck
```

Benchmark:

```bash
bun --cwd packages/cli benchmark:ccusage
```

If that script is missing or stale, add a focused benchmark script that uses fixture data and records timings for online collection, offline collection, submit, dashboard, and total command duration.

PostHog check after release:

```sql
SELECT event, count() AS count, max(timestamp) AS last_seen
FROM events
WHERE timestamp >= now() - INTERVAL 7 DAY
  AND event IN (
    'cli_first_run',
    'cli_authenticated',
    'login_completed',
    'usage_pushed',
    'usage_push_failed'
  )
GROUP BY event
ORDER BY event
LIMIT 100
```

Also inspect `usage_pushed` and `usage_push_failed` properties for timing and mode fields before using them in dashboards.

## Done Criteria

- Fresh first sync has a documented timing improvement or a documented measured baseline with no regression.
- First sync does not perform historical migration backfill before visible success.
- Explicit `--days` is respected.
- Dashboard fetch failure or slowness does not mask successful usage submit.
- CLI output clearly tells the user what happened and where to view it.
- CLI tests encode the new first-run behavior.
- Existing PostHog CLI events continue arriving after the change, with added timing and mode properties.

## Stop Conditions

- Stop if offline pricing materially changes submitted cost values without a correction path.
- Stop if historical backfill is required for data integrity rather than display richness.
- Stop if reducing telemetry shutdown loses required compliance or billing events.
