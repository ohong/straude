# Straude Performance Mission: every core page < 500ms

## Milestone status

- [x] M0 harness — acceptance: `bun run perf` scorecard for all 10 pages; `BASELINE.md` ready for the owner commit
- [ ] M1 PostHog RUM — code/docs complete; post-deploy `$web_vitals` acceptance remains non-gating
- [x] M2 auth consolidation — acceptance: TTFB drop; no direct `auth.getUser()` in (app); tests green
- [x] M3 waterfalls/duplicates — completed with M4/M5 before the final scorecard; tests green
- [x] M4 DB layer — snapshot migration and EXPLAIN baseline ready; production apply/advisor comparison remains a deploy check
- [x] M5 server caching — public snapshot reads cached; private/user-scoped data remains request-scoped; leakage tests green
- [x] M6 rendering/bundle — loading shells, server initial data, and analyzer baseline complete
- [ ] M7 goal loop — 10/10 local pass recorded; second consecutive clean-checkout pass remains

## Latest scorecard

Captured 2026-07-18 at 17:04 after M3 and the combined M4/M5 work, followed
by M6 rendering and bundle changes. Targets: TTFB <300ms and LCP <500ms.
All 10 pages pass both local gates.

| Page | TTFB | FCP | LCP | Server-Timing | Layout attribution | Pass |
|---|---:|---:|---:|---|---|:---:|
| `/feed` | 38ms | 94ms | 448ms | mw-auth:1ms | layoutAuth:2ms layoutProfile:30ms | PASS |
| `/leaderboard` | 38ms | 98ms | 452ms | mw-auth:1ms | layoutAuth:2ms layoutProfile:31ms | PASS |
| `/u/[username]` | 37ms | 94ms | 466ms | mw-auth:1ms | layoutAuth:2ms layoutProfile:29ms | PASS |
| `/post/[id]` | 37ms | 94ms | 444ms | mw-auth:1ms | layoutAuth:2ms layoutProfile:29ms | PASS |
| `/notifications` | 37ms | 92ms | 438ms | mw-auth:1ms | layoutAuth:1ms layoutProfile:30ms | PASS |
| `/messages` | 34ms | 110ms | 440ms | mw-auth:0ms | layoutAuth:2ms layoutProfile:28ms | PASS |
| `/prompts` | 35ms | 94ms | 94ms | mw-auth:1ms | layoutAuth:2ms layoutProfile:28ms | PASS |
| `/recap` | 39ms | 94ms | 442ms | mw-auth:0ms | layoutAuth:2ms layoutProfile:32ms | PASS |
| `/settings` | 42ms | 100ms | 454ms | mw-auth:0ms | layoutAuth:1ms layoutProfile:36ms | PASS |
| `/search` | 33ms | 88ms | 434ms | mw-auth:0ms | layoutAuth:1ms layoutProfile:28ms | PASS |

Right-sidebar API: 52ms. **10/10 pages passing.** The original pre-M2 baseline
and full method notes are in [`BASELINE.md`](BASELINE.md).


## Context

Every authenticated page currently takes a couple of seconds to load. Vercel Speed Insights costs $10/mo and we won't pay it, so we build our own free measurement stack (Playwright lab harness + PostHog RUM) and then optimize until every authenticated page passes. This plan is the long-horizon goal spec: it will be copied into `docs/perf/PLAN.md` as the cross-session tracker, and the lab scorecard (`bun run perf:check`) is the falsifiable goal check Claude runs each session.

**Why pages are slow (verified in code):**
1. **Auth validated 2–4× per navigation**, each a network round trip to Supabase: `proxy.ts` → [middleware.ts:68](apps/web/lib/supabase/middleware.ts) `getUser()`, then [app/(app)/layout.tsx:219](apps/web/app/(app)/layout.tsx) `getAuthUser()` (separate scope, not deduped), then 6 pages call `auth.getUser()` directly (recap, messages, post/[id], prompts, notifications).
2. **Layout blocks all children** on a profile `.single()` fetch ([layout.tsx:242-246](apps/web/app/(app)/layout.tsx)).
3. **Leaderboards are plain views** (matviews were dropped in migration `20260218224043`) doing full `GROUP BY` aggregations over `daily_usage` on every read — and the right-sidebar API hits `leaderboard_weekly` on **every** authenticated page. No covering index for the aggregation.
4. **Zero cross-request caching** in the authenticated app: no `unstable_cache`, no `"use cache"`, no tags. Only `React cache()` on `getAuthUser`.
5. **Waterfalls & duplicates**: `enrichFeedPosts` awaited after `get_feed` (feed + profile); profile page does 13 queries incl. 2–3 redundant full `daily_usage` scans; [lib/radar.ts](apps/web/lib/radar.ts) full-table-scans 5 tables per profile view (5-min per-instance cache only); `calculate_user_streak` RPC loops one query per streak day; messages page double-preloads conversations and signs URLs per message; post/[id] double-fetches auth + post via `generateMetadata`.
6. **No measurement tooling at all**: no web-vitals, no Server-Timing, no bundle analyzer, no perf tests.

## Definition of done (user-approved)

| Metric | Target | How measured |
|---|---|---|
| Server TTFB | < 300 ms | Lab harness: Playwright vs local prod build (`next build` + `next start`, prod Supabase), median of 5 warm runs (discard run 1) |
| LCP | < 500 ms | Same harness |
| RUM p75 TTFB / LCP | < 500 ms / < 1 s | PostHog web vitals — tracked as honesty check, **not gating** |

**Gating pages (ALL authenticated):** `/feed`, `/leaderboard`, `/u/[username]`, `/post/[id]`, `/notifications`, `/messages`, `/prompts`, `/recap`, `/settings`, `/search`. The mission is complete when `bun run perf:check` exits 0 (every gating page under target) and the result is reproducible on a second run.

**User-approved infrastructure decisions:**
- Migrate Supabase project `kanfzeovbmusnhmbnhit` to **asymmetric JWT signing keys** so middleware can verify tokens locally via `getClaims()` (regression-test CLI auth after).
- Enable **pg_cron** in Supabase to refresh leaderboard snapshots (~every 10 min).

## Milestones

Each milestone is independently committable; record scorecard-before/after in `docs/perf/PLAN.md` per milestone. Order matters: measure first.

### M0 — Lab measurement harness (no app changes)
- `apps/web/e2e/perf/auth.setup.ts`: authenticated Playwright fixture. Seed/create a perf test user (`PERF_TEST_EMAIL`/`PERF_TEST_PASSWORD` in `.env.local`, added to `.env.example`), sign in via login form or programmatic `signInWithPassword` → storageState.
- `apps/web/e2e/perf/pages.perf.spec.ts`: for each gating page, collect TTFB (`navigation.responseStart`), FCP (paint entries), LCP (buffered PerformanceObserver); 5 iterations, discard first, report median. Also measure `/api/app/right-sidebar` response time.
- `apps/web/e2e/perf/scorecard.ts`: writes `perf-results/scorecard.{json,md}` (gitignored) with pass/fail per page; **non-zero exit on any failure**.
- `apps/web/playwright.perf.config.ts`: `workers: 1`, no retries, `webServer: { command: "bun run start" }` (build separately) — use Playwright's webServer, not shell backgrounding.
- Scripts: `perf` (build + run harness), `perf:check` (the goal-loop command).
- **Server-Timing headers**: instrument `proxy.ts` (auth duration) and `app/(app)/layout.tsx` (auth, profile fetch) so the harness attributes TTFB; read via `navigation.serverTiming`.
- Commit `docs/perf/BASELINE.md` with the first scorecard, and create `docs/perf/PLAN.md` from this plan.
- **Acceptance:** `bun run perf` produces a scorecard with baseline numbers for all 10 pages.

### M1 — RUM via PostHog (free)
- Enable web-vitals capture in [PostHogProvider.tsx](apps/web/components/providers/PostHogProvider.tsx) — verify the current posthog-js option name against docs (likely `capture_performance: { web_vitals: true }`); stays behind the existing consent gate. Optionally add `useReportWebVitals` forwarding for App Router soft navigations (keep only one path if double-counting).
- `docs/perf/RUM.md`: the PostHog query/insight for p75 TTFB/LCP per pathname.
- **Acceptance:** `$web_vitals` events visible in PostHog after deploy.

### M2 — Auth consolidation (highest-leverage server win)
- Migrate project to asymmetric JWT signing keys (Supabase dashboard); verify CLI auth (`cli_auth_codes` flows) still works.
- Middleware: replace `getUser()` with `getClaims()` (local JWKS verification) in [lib/supabase/middleware.ts](apps/web/lib/supabase/middleware.ts). Verify current @supabase/ssr guidance first (supabase-js is 2.108.1).
- Extend [lib/supabase/auth.ts](apps/web/lib/supabase/auth.ts) into a `cache()`d `getAuthContext()` returning `{ user, profile }` in one fetch; use it in the app layout (replacing the L219 + L242 pair) and in the 6 pages calling `auth.getUser()` directly.
- post/[id]: wrap post fetch in `React cache()` so `generateMetadata` + page share one fetch/auth.
- **Acceptance:** scorecard TTFB drop across all pages; `grep -rn "auth.getUser()" "apps/web/app/(app)"` empty outside the helper; golden-path e2e + `migration-safety.test.ts` green.

### M3 — Kill waterfalls & duplicate queries (one commit per page)
- Layout: dedupe `loadLatestPosts` (DeferredSidebar vs PhotoNudge) via a `cache()`d loader; keep all sidebar queries inside Suspense.
- Profile [u/[username]/page.tsx](apps/web/app/(app)/u/[username]/page.tsx): fold `getProfileAccessContext`'s sequential follows lookup into the parallel batch; run `enrichFeedPosts` concurrently; redundant `daily_usage` scans collapse in M4.
- Feed [feed/page.tsx:66](apps/web/app/(app)/feed/page.tsx): parallelize enrichment or fold counts into `get_feed` (must stay SECURITY DEFINER; keep redaction invariants that `migration-safety.test.ts` enforces).
- Messages: remove second sequential `preloadConversation`; batch signed URLs via `createSignedUrls([...])`.
- Leaderboard page: merge the two sequential query waves.
- **Acceptance:** per-page scorecard deltas recorded; no page regresses; redaction tests green.

### M4 — Database layer (migrations via Supabase MCP `apply_migration`, per memory)
1. Covering index for leaderboard aggregation, e.g. `daily_usage(date, user_id) INCLUDE (cost_usd, output_tokens)` — validate with `EXPLAIN ANALYZE`.
2. Leaderboard snapshots: replicate the `open_stats_snapshots` JSONB pattern ([lib/open-stats.ts](apps/web/lib/open-stats.ts)); refresh via **pg_cron** every ~10 min; keep views as fallback; drop vestigial `refresh_leaderboards()` + `idx_leaderboard_*`.
3. Rewrite `calculate_user_streak` set-based (gaps-and-islands, mirroring `calculate_streaks_batch`) — it's called on every sidebar render.
4. New `get_profile_stats(user_id)` RPC: totals + contributions + radar inputs in one scan; replace [lib/radar.ts](apps/web/lib/radar.ts) full-table `getDistributions()` (fold distributions into the snapshot refresh).
- **Invariant:** any RPC reading non-public `users` columns (timezone, onboarding_completed, streak_freezes) must be SECURITY DEFINER — INVOKER RPCs silently fail under the column grants.
- **Acceptance:** EXPLAIN before/after captured; `/leaderboard` + `/u/[username]` scorecard deltas; `migration-safety.test.ts` green; Supabase advisors clean.

### M5 — Server-side caching
- `unstable_cache` (+ tags, 60–300 s revalidate) around: right-sidebar loader (`app/api/app/right-sidebar`), leaderboard snapshot reads, radar reads. Default to `unstable_cache`; only consider `"use cache"`/`cacheComponents` after verifying Next 16 stability.
- **Never** shared-cache per-user data (feed, messages, notifications) — request-scoped `cache()` only. Add an integration test asserting no user-scoped data in shared cache keys.
- **Acceptance:** right-sidebar timing in scorecard; leakage test green.

### M6 — Rendering & client bundle
- Ensure every gating page has `loading.tsx`/Suspense shell (currently only feed, leaderboard, post/[id], u/[username] have one).
- Add `@next/bundle-analyzer` behind `ANALYZE=1`; baseline in `docs/perf/bundles.md`; dynamic-import route-specific heavy deps (recharts, kbar, react-markdown, heic libs). `optimizePackageImports` already covers lucide/motion/recharts.
- Client-fetch pages (`/settings`, `/search`, `/card`) currently fetch in `useEffect` — move to server components or stream data to hit LCP targets.
- **Acceptance:** first-load JS per route in analyzer report; FCP/LCP scorecard deltas.

### M7 — Goal loop & regression guard
- `bun run perf:check` is the per-session goal check: run it, paste the scorecard into `docs/perf/PLAN.md`, work the worst failing page next.
- Optional: `@lhci/cli` in GitHub Actions for public pages (authed scorecard stays local — needs secrets).
- **Acceptance:** two consecutive `perf:check` passes on a clean checkout → mission complete; update `docs/CHANGELOG.md` + `docs/DECISIONS.md` (JWT keys, pg_cron, snapshot pattern).

## Current state snapshot (as of 2026-07-18, local performance gate passing)

- **Local result:** the 17:04 production-build harness completed 12/12
  Playwright checks with all 10 authenticated pages below both gates. TTFB is
  33-42ms, LCP is 94-466ms, and the right-sidebar median is 52ms.
- **Auth:** asymmetric ES256 signing plus `getClaims()` reduced middleware auth
  attribution from 25-30ms to 0-1ms while preserving authenticated behavior.
- **M3-M5:** waterfall/query deduplication and the private, service-only
  leaderboard/profile snapshot pattern were completed together before the
  final scorecard. Public snapshot reads use bounded shared caching; per-user
  data is not shared-cached. The pg_cron migration refreshes snapshots every
  10 minutes, but still requires production apply and advisor comparison.
- **M6:** every gating route has a loading boundary, initial settings/search/
  card/recap data is server-rendered, and bundle analysis removed about 39 KiB
  gzip of development-only JavaScript from each authenticated route.
- **Remaining checks:** run a second consecutive `bun run perf:check` on a
  clean checkout for M7. After deploy, confirm PostHog `$web_vitals` for M1;
  RUM is an honesty check and does not gate the local mission.

## Implementation notes

- The proxy exposes middleware auth duration through the standard
  `Server-Timing` header and the harness reads it from
  `PerformanceNavigationTiming.serverTiming`.
- App Router Server Components cannot mutate the response headers after the
  proxy returns. Layout auth/profile durations therefore use a perf-only JSON
  marker in the rendered document. The scorecard keeps this in a separate
  `Layout attribution` column instead of mislabeling it as `Server-Timing`.
- Generated scorecards, Playwright artifacts, and auth storage state are
  gitignored under `apps/web/perf-results/` and `apps/web/e2e/perf/.auth/`.

## Cross-session protocol

On session start: read `docs/perf/PLAN.md`, check milestone status against `git log`, run `bun run perf:check`, resume at the first incomplete milestone or the worst failing page. Commit after every milestone (small commits to `main` per repo convention). Keep `implementation-notes.md` deviations logged in `docs/perf/PLAN.md`.

**Interruption safety (user-directed):**
- Commit early and often — uncommitted progress is the only kind that gets lost. Any time a sub-step is done and green, commit it. Update the "Current state snapshot" section of `docs/perf/PLAN.md` (what's done, exact next action) before any risky/long operation and at every milestone boundary.
- **Session/usage limit handling:** if the session hits the usage limit before the performance target is met, read the limit-reset time from the Claude output, then schedule a wake-up message ("keep going") for 1 minute after the reset (scheduled-task/wakeup tooling) so the mission resumes automatically and runs to completion. On wake-up, follow the session-start protocol above.

## API uncertainties — verify with docs (Context7/find-docs) before implementing, never guess
- posthog-js web-vitals capture option name.
- `getClaims()` prerequisites + current @supabase/ssr middleware guidance.
- Next 16 `"use cache"`/`cacheComponents` status (default: `unstable_cache`).
- Playwright `webServer` + `next start` (Turbopack build) interplay.

## Verification
- Every milestone: `bun run perf:check` delta + `bun test` + `tsc --noEmit` + golden-path e2e.
- DB milestones additionally: `migration-safety.test.ts`, Supabase advisors, manual check that feed/profile render identically for a non-owner viewer (redaction).
- RUM check ~1 week after M2/M4 land: PostHog p75 should corroborate lab wins; if lab passes but RUM p75 is far off, revisit the metric definition with Oscar.
