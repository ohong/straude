# Security Audit

Last audited: 2026-02-18

## Inventory

| Component | Detail |
|-----------|--------|
| Stack | Next.js 16 (App Router) + Supabase (Postgres + Auth + Storage) |
| Client key | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (new model, not legacy anon) |
| Server key | `SUPABASE_SECRET_KEY` (env-only, never in client bundle) |
| Tables | 9 public tables, all with RLS enabled |
| API routes | 18 endpoints across auth, users, posts, social, upload, AI |
| Auth | Supabase Auth (GitHub OAuth), CLI JWT (HS256) |

## Findings

### Fixed

**CRITICAL: Open redirect in auth callback** — `apps/web/app/(auth)/callback/route.ts:7`

The `next` query parameter was used raw in `NextResponse.redirect()`. An attacker could craft `?next=//evil.com` to redirect users to a phishing page after login. Now validates the parameter is a relative path that doesn't start with `//`.

**HIGH: Missing security headers** — `apps/web/next.config.ts`

No X-Frame-Options, HSTS, X-Content-Type-Options, or Referrer-Policy. The app was frameable (clickjacking) and lacked MIME sniff protection. Added five headers to all routes:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

**HIGH: Mutable search_path on `calculate_streaks_batch`** — Supabase function

Flagged by Supabase security advisor. A mutable search_path allows a malicious schema to shadow the `public` schema. Pinned to `SET search_path = public`.

**MEDIUM: RLS performance on notifications** — `notifications` table policies

`auth.uid()` was re-evaluated per row instead of once per query. Replaced with `(select auth.uid())` pattern per Supabase docs.

### Requires Manual Action

**HIGH: Leaked password protection disabled** — Supabase Auth settings

Supabase can check passwords against HaveIBeenPwned to block known-compromised passwords. This is currently off. Enable in Supabase Dashboard > Authentication > Settings > Password Security.

### Passed

**RLS enabled on all 9 tables with appropriate policies.** Live database confirmed:

| Table | Policies | Write guard |
|-------|----------|-------------|
| `users` | 2 (SELECT, UPDATE) | `id = auth.uid()` |
| `posts` | 4 (SELECT, INSERT, UPDATE, DELETE) | `user_id = auth.uid()` |
| `comments` | 4 (SELECT, INSERT, UPDATE, DELETE) | `user_id = auth.uid()` |
| `follows` | 3 (SELECT, INSERT, DELETE) | `follower_id = auth.uid()` |
| `kudos` | 3 (SELECT, INSERT, DELETE) | `user_id = auth.uid()` |
| `daily_usage` | 3 (SELECT, INSERT, UPDATE) | `user_id = auth.uid()` |
| `notifications` | 2 (SELECT, UPDATE) | `user_id = auth.uid()` |
| `cli_auth_codes` | 2 (SELECT, UPDATE) | `user_id = auth.uid()` |
| `countries_to_regions` | 1 (SELECT) | Read-only reference table |

**No secrets in client-side code.** All Supabase client calls use `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (safe to expose). `SUPABASE_SECRET_KEY`, `CLI_JWT_SECRET`, and `ANTHROPIC_API_KEY` only appear in server-side files. No hardcoded keys found.

**All write endpoints require authentication.** Every POST/PATCH/DELETE API route checks `supabase.auth.getUser()` and returns 401 if missing. CLI endpoints validate JWT signatures with timing-safe comparison.

**Input validation on all user-facing endpoints.** Username regex `^[a-zA-Z0-9_]{3,20}$`, comment/bio/title length limits, file type whitelist + 5MB size cap on uploads, search min length, SSRF prevention on AI caption route.

**No XSS vulnerabilities.** No `dangerouslySetInnerHTML`. User content rendered as plain text via React's default escaping. `suppressHydrationWarning` only on non-user-controlled timestamps.

**No SQL injection.** All queries use Supabase SDK parameterized methods. No raw SQL or string interpolation.

**CORS configuration.** Relies on Next.js defaults (restrictive). No `Access-Control-Allow-Origin: *` anywhere.

### Accepted Risks

**Materialized views accessible to anon role.** Leaderboard data is intentionally public. The Supabase advisor flags `leaderboard_daily`, `leaderboard_weekly`, `leaderboard_monthly`, and `leaderboard_all_time`, but they contain only aggregated, non-sensitive data (usernames, output token counts, streaks).

**`comments`/`follows`/`kudos` SELECT policies use `USING (true)`.** Anyone can read all comments, follow relationships, and kudos. This is intentional for a social platform where this data is public. Write policies still enforce ownership via `auth.uid()`.

## Summary

| Severity | Found | Fixed | Manual | Accepted |
|----------|-------|-------|--------|----------|
| CRITICAL | 1 | 1 | 0 | 0 |
| HIGH | 3 | 2 | 1 | 0 |
| MEDIUM | 1 | 1 | 0 | 0 |
| INFO | 2 | 0 | 0 | 2 |

## Remaining Action Items

1. **Enable leaked password protection** in Supabase dashboard (HIGH)
2. **Add rate limiting** to data creation endpoints — see ROADMAP.md
3. **Add Content Security Policy** once all script/style sources are inventoried — see ROADMAP.md
