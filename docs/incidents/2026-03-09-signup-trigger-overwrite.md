# Incident Post-Mortem: Signup Trigger Silently Overwritten

**Date**: 2026-03-09
**Severity**: Critical (P0)
**Duration**: ~3 days (2026-03-06 12:19 UTC – 2026-03-09 ~21:00 UTC)
**Impact**: 16 users who signed up during this window were unable to use the product
**Status**: Resolved

---

## Summary

A database migration applied directly to production used `CREATE OR REPLACE FUNCTION` on the `handle_new_user()` trigger function, replacing its body with one that inserted into a different table (`public.profiles`) instead of the required `public.users` table. For 3 days, every new signup completed Supabase Auth successfully but silently failed to create the corresponding application user record. Affected users saw errors or blank states when attempting to use the product.

---

## Timeline

| Time (UTC) | Event |
|---|---|
| 2026-02-16 | `handle_new_user()` created in initial schema migration. Inserts into `public.users` on every `auth.users` INSERT. |
| 2026-02-16 | Security fix migration redefines `handle_new_user()` with `SET search_path = public`. Behavior preserved — still inserts into `public.users`. |
| 2026-02-19 | Security hardening migration locks down EXECUTE permissions on `handle_new_user()`. Function body unchanged. |
| **2026-03-06 ~12:19** | **Ad-hoc migration applied directly to production DB** (not committed to repo). Uses `CREATE OR REPLACE FUNCTION public.handle_new_user()` to insert into `public.profiles` instead of `public.users`. Last successful `public.users` row created at this timestamp. |
| 2026-03-06 12:19 – 2026-03-09 | 16 users sign up. Auth succeeds, `public.profiles` rows created, but no `public.users` rows. Users cannot complete onboarding, do not appear in feeds or search, cannot use the CLI. |
| **2026-03-09 ~20:00** | Bug reported: Suggested Friends showing empty results. Investigation begins. |
| 2026-03-09 ~20:30 | Root cause identified: `handle_new_user()` function body had been replaced. |
| 2026-03-09 ~21:00 | Fix migration applied: function restored to insert into both `public.users` and `public.profiles`. All 16 missing `public.users` rows backfilled. |

---

## Root Cause

PostgreSQL's `CREATE OR REPLACE FUNCTION` **silently overwrites** an existing function's body without any warning, error, or confirmation. A migration intended to add a new feature used this statement on `public.handle_new_user()`, replacing the function that inserts into `public.users` with one that only inserts into `public.profiles`.

The critical factors:

1. **Silent overwrite**: `CREATE OR REPLACE` is a non-destructive DDL statement in PostgreSQL's eyes — it doesn't drop the function, it just replaces the body. There is no built-in guardrail against accidentally changing a function's behavior.

2. **Applied directly to production**: The migration was run against the production Supabase database via the SQL editor, bypassing the normal migration workflow. It was never committed to the repository, so no code review or CI checks ran against it.

3. **No monitoring on the critical path**: We had no alerting on signup success rate, no integration test verifying the trigger's behavior, and no row-count checks on `public.users` vs `auth.users`.

4. **Trigger functions are invisible**: Unlike a broken API endpoint that returns a 500, a trigger function that silently writes to the wrong table produces no user-visible error. Auth succeeds, the user gets a session, and the app loads — but with no backing data.

---

## Impact

- **16 users** signed up between March 6–9 and were unable to use the product
- All 16 had:
  - `auth.users` row (authentication worked)
  - `public.profiles` row (the overwritten trigger wrote here)
  - **No `public.users` row** (the app's primary user table)
- These users could not:
  - Complete onboarding (username selection, profile setup)
  - Appear in the global feed, leaderboard, or search results
  - Use the CLI (`daily_usage` has a FK to `users.id`)
  - Be found by other users via Suggested Friends
- **0 sessions logged**, **0 posts created**, **$0 spend tracked** across all 16 users
- Two secondary bugs were also uncovered during investigation:
  - Suggested Friends queries used the publishable key client, so RLS blocked private users from appearing in suggestions
  - Email-based user search was broken because the `lookup_user_id_by_email` RPC had been restricted to `service_role` only

---

## Resolution

### Immediate fix (2026-03-09)

1. **Restored `handle_new_user()`** to insert into both `public.users` AND `public.profiles`, ensuring forward compatibility
2. **Backfilled all 16 missing `public.users` rows** from `auth.users` metadata (github_username, avatar_url, timezone)
3. **Verified all 16 users** have `onboarding_completed: false` and `is_public: true`, meaning they can re-enter the onboarding flow
4. **Fixed Suggested Friends** to use the service client (bypasses RLS for server-side queries)
5. **Fixed email search** to use the service client for the `lookup_user_id_by_email` RPC
6. **Drafted reactivation email** to notify affected users that their accounts are ready

### Migration applied

```sql
-- Migration: 20260309210000_fix_handle_new_user_trigger.sql

-- Restore handle_new_user to insert into BOTH tables
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, github_username, avatar_url, timezone)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'user_name',
          NEW.raw_user_meta_data ->> 'avatar_url',
          COALESCE(NEW.raw_user_meta_data ->> 'timezone', 'UTC'))
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
          NEW.raw_user_meta_data->>'avatar_url')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;

-- Backfill missing public.users rows
INSERT INTO public.users (id, github_username, avatar_url, timezone)
SELECT a.id, a.raw_user_meta_data ->> 'user_name', a.raw_user_meta_data ->> 'avatar_url',
       COALESCE(a.raw_user_meta_data ->> 'timezone', 'UTC')
FROM auth.users a LEFT JOIN public.users u ON a.id = u.id
WHERE u.id IS NULL ON CONFLICT (id) DO NOTHING;
```

---

## Prevention: What We Added

### 1. Migration safety tests (`__tests__/unit/migration-safety.test.ts`)

Five automated tests that scan every `.sql` migration file in the repo:

| Test | What it catches |
|---|---|
| `handle_new_user() must always insert into public.users` | The latest migration redefining the function must include `INSERT INTO public.users` |
| `no migration redefines handle_new_user without inserting into public.users` | **Every** migration that touches this function must include the insert — not just the latest |
| `handle_new_user trigger exists on auth.users` | At least one migration creates the `on_auth_user_created` trigger |
| `no migration drops the trigger without recreating it` | If a migration drops the trigger, it must also recreate it in the same file |
| `finds migration files` | Sanity check that the test is actually reading migration files |

These tests run in CI on every pull request. Any migration that overwrites `handle_new_user()` without preserving the `INSERT INTO public.users` will fail the build.

### 2. Process change: no ad-hoc production migrations

The root migration was applied directly to the production database via the Supabase SQL editor, bypassing code review, CI, and the migration history. Going forward:

- **All migrations must be committed to the repository** and applied through the standard migration pipeline
- **No ad-hoc SQL** against production outside of emergency hotfixes, which must be immediately back-ported to a migration file and committed
- The Supabase SQL editor should be used for **read-only queries** only

---

## Lessons Learned

### What went well

- Once the bug was reported, root cause was identified within 30 minutes
- The backfill was clean — `auth.users` had all the metadata needed to reconstruct `public.users` rows
- `ON CONFLICT DO NOTHING` in the fix migration made it safe to re-run

### What went wrong

- **`CREATE OR REPLACE FUNCTION` is dangerous.** It looks like a safe, additive DDL statement, but it silently replaces the function body. There's no PostgreSQL-native way to prevent this. Our safety net must be at the process and CI level.
- **No integration test for the signup flow.** We had unit tests for individual API routes but nothing that verified "a new auth signup produces a `public.users` row." This is the single most critical path in the application.
- **No monitoring on user table parity.** A simple scheduled query — `SELECT COUNT(*) FROM auth.users WHERE id NOT IN (SELECT id FROM public.users)` — would have caught this within minutes, not days.
- **Ad-hoc production changes bypass all safety checks.** Code review, CI, migration history, and automated tests are all useless if changes are applied directly to the database.

### What we should do next

1. **Add a scheduled parity check**: Alert if `auth.users` count diverges from `public.users` count by more than 0. This is the single highest-leverage monitoring improvement.
2. **Add an e2e signup test**: Playwright test that completes OAuth signup and verifies a `public.users` row exists.
3. **Consider restricting `CREATE OR REPLACE` in CI**: A lint rule that flags any migration using `CREATE OR REPLACE FUNCTION public.handle_new_user` and requires explicit approval.
4. **Document critical trigger functions**: Maintain a list of functions where silent overwrites would be catastrophic, so contributors know to be careful.

---

## Related Changes

| Commit / Migration | Description |
|---|---|
| `20260309210000_fix_handle_new_user_trigger.sql` | Restores trigger function + backfills 16 users |
| `__tests__/unit/migration-safety.test.ts` | 5 migration safety tests |
| `__tests__/api/search.test.ts` | Updated search tests for service client |
| `components/app/shared/RightSidebar.tsx` | Suggested Friends → service client |
| `app/api/search/route.ts` | Email search → service client |
