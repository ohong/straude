# Incident Post-Mortem: `collector_meta` Schema Drift Blocked All CLI Pushes

**Date**: 2026-04-28
**Severity**: Critical (P0)
**Duration**: ~4 days (2026-04-24 18:55 UTC – 2026-04-28 20:25 UTC)
**Impact**: Every `straude push` writing fresh daily data was rejected with HTTP 500 for the entire window. North-star metric (cumulative `cost_usd` in `daily_usage`) frozen for new logging activity.
**Status**: Resolved

---

## Summary

PR #92 ("Fix inflated Codex usage accounting") atomically introduced (a) writes to a new `collector_meta jsonb` column on `device_usage` and `daily_usage` from `apps/web/app/api/usage/submit/route.ts`, and (b) a migration `20260424133000_add_usage_collector_meta.sql` that adds the column. The application code was deployed to Vercel on merge. The migration was never pushed to the linked Supabase project. For ~4 days, every CLI push failed with `Could not find the 'collector_meta' column of 'device_usage' in the schema cache`, returning HTTP 500 from `/api/usage/submit`. Five other unrelated migrations (RLS hardening from 2026-04-13 and 2026-04-27) had drifted out of sync the same way and were also pending.

---

## Timeline

| Time (UTC) | Event |
|---|---|
| 2026-04-13 02:45 / 03:05 / 03:45 | Three RLS hardening migrations committed (`get_feed`, DM attachment ownership, `users` public columns). Not pushed to remote. |
| **2026-04-24 18:53:48** | **PR #92 merged to `main` (commit `d189252`).** Adds `collector_meta` writes in `usage/submit/route.ts` (3 sites) and migration `20260424133000_add_usage_collector_meta.sql`. |
| **2026-04-24 ~18:55–18:58** | **Vercel auto-deploys `main`. Bug goes live in production.** Every subsequent CLI push attempting to write a new `device_usage` row hits the missing column. |
| 2026-04-24 18:55 – 2026-04-28 20:24 | All CLI pushes for fresh dates fail. The route's `Promise.allSettled` catches the per-entry exception, but with all entries failing the route returns HTTP 500. Some re-pushes silently no-op'd at the device level via the cost-monotonicity guard (`mayOverwriteDevice = false`) but still hit the same error on the `daily_usage` upsert (route.ts:357). Net effect: zero new daily-usage rows logged for ~4 days. |
| 2026-04-27 19:00 / 19:10 | Two more RLS migrations committed (private post interactions, DM insert pair scope). Not pushed to remote. |
| **2026-04-28 ~20:00** | Bug surfaced via failing `straude push v0.1.21` output pasted into Claude Code. |
| 2026-04-28 20:10 | Root cause identified via `supabase migration list --linked` showing 6 migrations with blank Remote columns. |
| **2026-04-28 ~20:25** | `supabase db push --linked --include-all` applied all 6 pending migrations. PostgREST schema cache reloaded automatically. CLI pushes resumed working. |

---

## Root Cause

The repo's deploy pipeline runs the application build on merge to `main` but does **not** apply Supabase migrations. Migration application is a manual step (`supabase db push --linked`) that wasn't in the merge checklist or CI.

PR #92 followed a good practice — shipping the application-layer write and the schema migration in the same commit — which made the failure more likely to surface immediately on deploy rather than later. But because the manual migration step was skipped, the application started writing to a column that didn't exist in production.

The critical factors:

1. **Asymmetric automation between code and schema.** `git push` → Vercel deploy is fully automated. `git push` → Supabase migration push is fully manual. Any contributor who forgets the second step ships schema drift.

2. **No CI gate on pending migrations.** Nothing in CI ran `supabase migration list --linked` against production-shape state to flag that committed migrations hadn't been applied.

3. **Local tests passed against the migrated schema.** Vitest and the Supabase local dev DB run `supabase db reset`, which applies every migration in the repo. So the test suite validated the route against a database state that production didn't have.

4. **No alerting on `/api/usage/submit` 5xx rate.** The single most important endpoint for the north-star metric had no monitoring. Loud Postgres errors were going to every CLI user but nowhere in our dashboards.

5. **Codex agents authoring migrations had no path to apply them.** The Codex sessions that wrote the migration files (PR #92 and the five RLS PRs) had filesystem access to drop migrations into `supabase/migrations/` but no Supabase CLI / MCP plugin to actually push them. Drift was a structural outcome, not a one-off oversight.

---

## Impact

- **All users pushing fresh daily data were 500'd** for ~4 days, ~97.5 hours.
- When `existingDevice` was null (first push of a given date), `mayOverwriteDevice` was unconditionally true → upsert fired → threw on the missing column → entry rejected.
- When `existingDevice` existed and the cost guard skipped the device upsert, the route still proceeded to upsert into `daily_usage`, which also writes `collector_meta` → same error → entry rejected.
- **0 new `daily_usage` rows logged from CLI pushes** during the window (excluding the trickle of submissions that happened to come from web, which uses the same route and column).
- **Cumulative `cost_usd` in `daily_usage` (north-star metric) frozen** with respect to fresh logging activity for the duration. Backfill is possible because users still have local ccusage data; nothing was lost on the client side.
- **Compounding drift.** Five other unrelated migrations (three from 2026-04-13, two from 2026-04-27) had been silently sitting unpushed for up to 15 days. Their absence didn't cause a visible failure (they're additive RLS hardening), but production was running on weaker security policies than the repo claimed.
- **No silent corruption.** The error was loud (`throw` → 500 response). No half-written rows.

---

## Resolution

### Immediate fix (2026-04-28)

1. **Linked the local Supabase CLI to the production project** (`supabase link --project-ref kanfzeovbmusnhmbnhit`).
2. **Listed pending migrations** (`supabase migration list --linked`) and confirmed 6 with blank Remote columns.
3. **Inspected each pending migration** for safety. All idempotent: 1 additive column (with `IF NOT EXISTS`), 5 RLS / `CREATE OR REPLACE FUNCTION` revisions.
4. **Pushed all 6** via `supabase db push --linked --include-all`.
5. **Verified** Local and Remote columns now match for every migration.
6. PostgREST auto-reloads its schema cache on DDL via `NOTIFY pgrst`; no manual cache invalidation required.

### Migrations applied

```
20260413024500_harden_get_feed_user_visibility.sql
20260413030500_harden_direct_message_attachment_ownership.sql
20260413034500_harden_users_public_columns.sql
20260424133000_add_usage_collector_meta.sql        ← fixes the CLI failure
20260427190000_harden_private_post_interactions.sql
20260427191000_fix_direct_message_insert_pair_scope.sql
```

---

## Prevention: What We're Adding

### 1. Codex agents get the Supabase plugin / CLI

The structural fix: any Codex (or other coding-agent) session that can author a migration file must also be able to apply it. We will:

- **Install the Supabase MCP plugin** in our standard Codex session bootstrap so agents can apply migrations through the MCP layer without OAuth friction in-loop.
- **Install the `supabase` CLI** in the agent's tool environment with `supabase link` already run against the production project.
- **Update agent instructions** so that whenever a migration file is written, the agent also runs `supabase db push --linked` (or the MCP equivalent) against the linked project before considering the task complete.

This converts migration application from a manual checklist item into a tool-enforced step. The agent that authors the schema change is the one that applies it.

### 2. CI gate on migration drift (proposed, not yet implemented)

A CI check on every PR that adds a `supabase/migrations/*.sql` file:

- Run `supabase migration list --linked` against a production-shape connection.
- If the count of migrations with blank Remote columns is non-zero on `main` post-merge, fail the build / page the on-call.

### 3. 5xx alerting on `/api/usage/submit` (proposed, not yet implemented)

This is the single most important endpoint for the north-star metric and currently has no monitoring. A simple alert on `>1% 5xx rate over 5 minutes` would have caught this within minutes, not days.

### 4. Production smoke test post-deploy (proposed, not yet implemented)

A tiny synthetic `usage/submit` POST that runs after each deploy and exercises the full schema. Catches schema drift in seconds.

---

## Lessons Learned

### What went well

- Once the user pasted the failing CLI output, root cause was identified within ~10 minutes via `supabase migration list --linked`.
- The fix was a single command (`supabase db push --linked --include-all`) and required no data backfill — the column is nullable and additive, so no historical rows needed repair.
- All 6 pending migrations were idempotent and safe to apply in one batch. No partial-failure recovery needed.
- The error was loud. The CLI surfaced the underlying Postgres error verbatim, which made the diagnosis trivial.

### What went wrong

- **Schema deploy is manual, code deploy is automatic.** This asymmetry is the structural cause. Until the two sides are equally automated, this class of bug will recur.
- **Coding agents could write migrations but couldn't push them.** PR #92 and the five RLS PRs were authored by Codex sessions. None of those sessions had the tooling to apply the migration they had just written. The drift was inevitable, not a one-off mistake.
- **No alerting on the most important endpoint.** Four days of 100% failure on `/api/usage/submit` produced zero pages.
- **Local tests provide false confidence.** The route's tests passed locally because `supabase db reset` had applied the migration. Production had not. We need test environments that can model "code deployed but migration not applied."
- **Drift compounds silently.** The collector_meta migration broke something visible. The five RLS migrations from 2026-04-13 and 2026-04-27 broke nothing visible but had still been pending for up to 15 days. Without a drift check, we'd never have noticed.

### What we should do next

1. **Ship the Codex-Supabase tooling change first.** Every contributor session, human or agent, needs the same access to the migration push step that they have to the code push step. This is the single highest-leverage fix.
2. **Add a `supabase migration list --linked` drift check to CI** so unpushed migrations on `main` cause a loud failure, not a silent one.
3. **Add 5xx alerting on `/api/usage/submit`** before any other observability work.
4. **Add a post-deploy smoke test** that exercises the live schema against the just-deployed code.

---

## Related Changes

| Commit / Migration | Description |
|---|---|
| `d189252` (PR #92) | Introduced `collector_meta` writes and the matching unpushed migration |
| `20260424133000_add_usage_collector_meta.sql` | Adds `collector_meta jsonb` to `device_usage` and `daily_usage` (now applied) |
| `20260413024500` / `30500` / `34500` / `20260427190000` / `191000` | Five RLS hardening migrations that had drifted alongside (now applied) |
| `docs/CHANGELOG.md` | Logged the fix under Unreleased > Fixed |
