# Architecture & Design Decisions

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
