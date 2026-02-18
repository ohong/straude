# Architecture & Design Decisions

## Security Headers in next.config.ts (2026-02-18)

**Decision:** Added `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`, `Referrer-Policy`, and `Permissions-Policy` headers to all routes via `next.config.ts`.

**Why no CSP yet:** A strict Content-Security-Policy requires auditing all inline scripts, style sources, and third-party origins (Supabase, Vercel Analytics, any CDN images). Adding a CSP that's too restrictive breaks the app; adding one that's too permissive (`unsafe-inline`) provides little value. Deferred to a follow-up where each source can be inventoried and nonce-based CSP applied.

**Alternatives considered:**
1. **Custom proxy.ts headers** — ties security to auth middleware; headers should apply to all routes unconditionally.
2. **Vercel vercel.json headers** — platform-specific; `next.config.ts` is portable.
3. **next.config.ts `headers()`** (chosen) — standard Next.js approach, applies at build time, works on all deploy targets.

## Open Redirect Prevention in Auth Callback (2026-02-18)

**Decision:** The `next` query parameter in `/callback` is validated to ensure it starts with `/` and does not contain `//` before use in a redirect.

**Problem:** `NextResponse.redirect(\`${origin}${next}\`)` with an unvalidated `next` parameter allows an attacker to craft `?next=//evil.com`, which some browsers interpret as a protocol-relative URL redirect.

**Fix:** Simple allowlist check — must start with `/` and must not start with `//`. Falls back to `/feed` on failure.

## SSRF Prevention: Image URL Allowlisting (2026-02-18)

**Decision:** The `/api/ai/generate-caption` endpoint validates that all image URLs belong to the project's Supabase storage origin before passing them to the Anthropic API.

**Problem:** The endpoint accepted arbitrary URLs from the client and forwarded them to Anthropic's vision API. An attacker could pass internal network URLs or attacker-controlled hosts, using the server as a proxy (SSRF).

**Why allowlist over blocklist:** Blocklists (e.g., blocking `localhost`, `169.254.x.x`) are easily bypassed via DNS rebinding, IPv6, or URL encoding tricks. Allowlisting the known Supabase storage domain is the only reliable defense.

## Next.js 16: proxy.ts Not middleware.ts (2026-02-18)

**Decision:** This project uses `proxy.ts` for request interception, not `middleware.ts`. Next.js 16 introduced the proxy file convention; having both files causes a hard build failure.

**Implication:** Any auth guards, redirects, or request transforms must be added to `apps/web/proxy.ts`. Never create a `middleware.ts` file.

## Deterministic Render Data for SSR Components (2026-02-17)

**Decision:** Landing page components that need varied visual data (e.g., contribution graphs) use hardcoded static arrays instead of `Math.random()`.

**Problem:** `ProfileMockup` generated contribution graph cells with `Math.random()`, producing different values on server and client. React logged hydration mismatch errors for every cell.

**Alternatives considered:**
1. **`suppressHydrationWarning`** — hides the error but leaves visual flicker on hydration.
2. **Client-only rendering via `useEffect`** — delays the graph until after hydration, causing a visible pop-in.
3. **Deterministic static data** (chosen) — a `CONTRIBUTION_CELLS` constant provides the same values on server and client.

**Why option 3:** Zero runtime cost, no visual flicker, no suppressed warnings. The data is decorative — it doesn't need to be dynamic.

## Landing Page Voice: Athletic/Endurance Theme (2026-02-17)

**Decision:** All landing page copy follows an "endurance athlete meets Claude Code power user" voice. Language evokes training logs, sessions, streaks, pace, and discipline.

**Why:** Straude is positioned as "Strava for Claude Code." The copy should reinforce that analogy throughout — not just in the tagline. Generic SaaS language ("Get Started", "Features", "Social proof") was replaced with athletic vocabulary ("Start Logging", "Built for the daily grind", "Locked in.").

**Design research:** Studied superpower.com (by Daybreak Studio), tryflint.com, and slope.agency for patterns. Key takeaways applied: single accent color for CTAs only, outcome-first hierarchy, restraint as a design signal, never label a section "Social proof", typography carries hierarchy over color.

## E2E Tests with Playwright (2026-02-17)

**Decision:** Added Playwright alongside Vitest. Vitest handles unit/component tests; Playwright handles full-page browser tests.

**Why:** The hydration error was only reproducible in a real browser — JSDOM doesn't run React's hydration reconciliation. Playwright catches console errors that unit tests miss.

**Config:** Uses `reuseExistingServer: true` locally (avoids port conflicts with running dev servers) and spins up its own server in CI.

## Strava-Inspired Layout: Top Header + Profile Sidebar (2026-02-17)

**Decision:** Replaced the left navigation sidebar with a Strava-style user profile card. Navigation moved to a new sticky top header bar (hidden on mobile, where the bottom nav handles it).

**Alternatives considered:**
1. **Keep nav sidebar, add header on top** — cluttered, duplicates navigation.
2. **Merge nav into mobile-style bottom bar for all viewports** — loses the profile card real estate on desktop.
3. **Top header for nav, left column for profile card** (chosen) — mirrors Strava's dashboard layout, gives each concern its own space.

**Why option 3:** Users see their own profile/stats at a glance (streak, follower counts, latest activity) without navigating away from the feed. The top header is a well-understood pattern for site-wide navigation. Mobile stays unchanged (bottom nav).

**Data fetching:** Sidebar data (follower/following counts, streak, latest post) is fetched in `Promise.all` in the app layout alongside the existing profile query, keeping server-side data loading parallel.

## Streak RPC: UTC Date Fallback (2026-02-17)

**Decision:** `calculate_user_streak` checks `CURRENT_DATE` first; if no usage exists, falls back to `CURRENT_DATE - 1` before returning 0.

**Problem:** Supabase runs in UTC. A user in UTC-8 who logged activity at 10pm local time (6am UTC next day) would have no usage for the current UTC date until their next session. The streak function returned 0 despite 8 consecutive days of data.

**Alternatives considered:**
1. **Pass user timezone to the RPC** — more accurate but adds complexity and requires the client to always supply timezone.
2. **Check yesterday as fallback** (chosen) — simple, handles the common case where the user hasn't pushed yet today.

**Why option 2:** The one-day grace period covers the UTC offset gap for all timezones (max offset is UTC+14/UTC-12). No client changes needed. If the user truly hasn't logged in 2+ days, it correctly returns 0.

## Notifications: Table + API Route Pattern (2026-02-17)

**Decision:** Notifications are inserted from existing API routes (follow, kudos, comments) rather than using database triggers.

**Alternatives considered:**
1. **Database triggers** — auto-insert on `follows`/`kudos`/`comments` insert. Decoupled but harder to debug, can't skip self-notifications cleanly.
2. **Application-level inserts in API routes** (chosen) — explicit, easy to add conditions (skip self-notifications), fire-and-forget.

**Why option 2:** The API routes already have the auth context needed to determine actor and target. Self-notification skipping is a simple `if` check. Notification inserts are non-blocking (fire-and-forget) so they don't slow down the primary operation. Triggers would require plpgsql logic for the self-notification check and are harder to test.

## CLI Default Command: Smart Sync (2026-02-17)

**Decision:** Running `npx straude@latest` with no arguments triggers a "sync" flow that authenticates if needed, then pushes only new stats since the last push.

**Alternatives considered:**
1. **Always push today only** — simple but forces users to manually backfill gaps.
2. **Server-side diff** — query the API for existing dates, push missing ones. More accurate but adds a network round-trip and requires a new API endpoint.
3. **Local `last_push_date` tracking** (chosen) — store the last successful push date in `~/.straude/config.json`, compute the diff client-side.

**Why option 3:** Zero server changes, no extra network call, works offline for date computation. The trade-off is that if a user pushes from a different machine, the local state won't know — but this is an acceptable edge case for v1. The `push` command with `--days` remains available for manual backfill.

## Incremental Push Date Tracking

**Decision:** `last_push_date` is persisted in `~/.straude/config.json` alongside auth credentials. Updated after every successful push (both explicit `push` and default `sync`).

**Behavior:**
- No `last_push_date` (first push): push today only.
- `last_push_date` < today: push from `last_push_date` to today (gap days), capped at `MAX_BACKFILL_DAYS` (7).
- `last_push_date` >= today: print "Already synced today" and exit.

**Why local over server:** Avoids coupling the CLI default flow to a server endpoint that doesn't exist yet (`/api/users/me/status` GET handler is unimplemented). Keeps the CLI self-contained.

## Date Arithmetic: String-Based Local Parsing

**Decision:** `daysBetween()` in `sync.ts` parses date strings as local dates (`new Date(year, month-1, day)`) rather than using `new Date("YYYY-MM-DD")`.

**Why:** `new Date("2026-02-14")` parses as UTC midnight, while `new Date()` returns local time. In timezones west of UTC, this causes an off-by-one error (e.g., 3 days ago computes as 4). Parsing components explicitly into local dates eliminates this class of bug.

## Subcommands Remain Available

**Decision:** `login`, `push`, `status` remain as explicit subcommands. The default (no subcommand) is additive, not a replacement.

**Why:** Power users and CI workflows may need explicit control (e.g., `push --days 7 --dry-run`). The default sync command is sugar for the common case.

## `pushCommand` Accepts Optional Config Override

**Decision:** `pushCommand(options, configOverride?)` accepts an optional config parameter so the sync command can pass in the config it already loaded (or obtained post-login) without calling `requireAuth()` again.

**Why:** The sync flow loads config to check auth state, then optionally runs login. Passing the config avoids a redundant file read and prevents `requireAuth()` from `process.exit(1)` in a context where we already handled the unauthenticated case.

## `--api-url` Overrides Stored Config (2026-02-17)

**Decision:** When `--api-url` is passed, it overrides the `api_url` in stored config for the current invocation — without mutating the persisted config file.

**Bug:** A user who ran `straude login --api-url http://localhost:3000` had `api_url: "http://localhost:3000"` saved in config. When they later ran `straude --api-url http://localhost:3001`, the push still hit port 3000 because the stored config took precedence.

**Fix:** Both `syncCommand` and `index.ts` (for direct `push`) merge the override into a copy of the config before passing it to `pushCommand`. The persisted config is not mutated.

## Integration Flow Tests (2026-02-17)

**Decision:** Added `__tests__/flows/cli-sync-flow.test.ts` that mocks only at boundaries (fetch, fs, child_process) rather than at module boundaries.

**Why:** The existing unit tests mock `apiRequest`, `requireAuth`, etc. — which means they never exercise the actual HTTP URL construction, header assembly, or config-to-API wiring. The flow tests caught the `--api-url` override bug and verify exact endpoint paths, preventing silent 404s.

## "Already Synced" Stats Preview (2026-02-18)

**Decision:** When the user has already synced today, the CLI still runs `ccusage` and prints today's stats before showing "Already synced today."

**Why:** Users run `bunx straude` to see their stats as much as to push them. Silently exiting with just a message gives no feedback on current usage. Showing the stats makes the CLI useful as a dashboard command even when there's nothing new to push. The ccusage call is best-effort — failures are silently caught so the "already synced" message always appears.

## npm Publish: `main` Field Required for ESM Bin Packages (2026-02-18)

**Decision:** Added `"main": "dist/index.js"` to `package.json` alongside the `bin` entry.

**Bug:** npm 11 silently strips the `bin` entry during publish for ESM packages (`"type": "module"`) that lack a `main` field, with the warning `"bin[straude]" script name was invalid and removed`. The published package had no binary, so `npx straude` failed.

**Fix:** Adding `main` pointing to the same entrypoint satisfies npm's validation. The `main` field is redundant for a CLI-only package but harmless.
