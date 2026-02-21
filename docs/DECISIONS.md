# Architecture & Design Decisions

## Shareable Recap Cards: Shared Utility + OG Image Pattern (2026-02-21)

**Decision:** Recap data computation lives in a shared utility (`lib/utils/recap.ts`) used by both the API route and OG image generator. The OG image card JSX is a separate shared component (`lib/utils/recap-image.tsx`) reused across the landscape OG route and square download endpoint. The public recap page at `/recap/[username]` is outside the `(app)` route group so it doesn't require auth, while the card preview page at `/(app)/recap` is inside the auth-protected group.

**Alternatives considered:**
1. **Inline all stats computation in each route** — leads to duplicated date math and model resolution logic across 3+ files.
2. **Single API route that generates both data and images** — OG images need to be on a specific file convention path (`opengraph-image.tsx`), so they need their own route regardless.
3. **Canvas-based image generation (Puppeteer, Playwright)** — heavyweight dependency. `next/og` ImageResponse is already proven in this codebase and requires no extra infra.

**Why service client for OG image:** The OG image route is hit by crawlers (Twitter, LinkedIn) without user auth cookies. Using the service client (`getServiceClient()`) allows fetching the public user's data without requiring a session.

## Image Gallery: 5-Image Preview Limit, No External Carousel (2026-02-21)

**Decision:** The feed grid shows at most 5 images with a "+N" overlay for the remainder. The lightbox is a custom component using `createPortal`, not an external carousel library.

**Alternatives considered:**
1. **Show all images in the grid** — clutters the feed card, especially with 10 images. Strava caps at 5 visible.
2. **External carousel library (Swiper, Embla)** — adds a dependency for a feature that only needs prev/next navigation and swipe. The custom lightbox is ~100 lines with keyboard, touch, and a11y support built in.
3. **CSS scroll-snap gallery** — inline scrolling doesn't provide the full-screen immersive experience users expect from image lightboxes.

**Why 5:** Mirrors Strava's pattern. The 5-image layout (tall left + 2x2 right) is visually balanced. The "+N" overlay creates curiosity to click through — good for engagement.

## Email Notifications: React Email + Idempotency Keys (2026-02-21)

**Decision:** Upgraded email templates from raw HTML strings to React Email components (`@react-email/components`). Extended notifications to cover both comments and @mentions. Added idempotency keys (`comment-notif/{commentId}`, `mention-notif/{commentId}/{userId}`, `mention-post/{postId}/{userId}`) and Resend tags for tracking. Using Resend's `react` parameter which auto-generates both HTML and plain text.

**Why React Email over raw HTML:** Component-based, Tailwind-styled emails with `pixelBasedPreset` (rem→px). Resend SDK auto-generates plain text from the React tree — no manual `text` field needed. Easier to maintain and extend to new notification types.

## Email Notifications: Fire-and-Forget with Stateless Unsubscribe (2026-02-20)

**Decision:** Send notification emails directly from API routes via Resend, fire-and-forget (non-blocking). Unsubscribe tokens use HMAC-signed stateless tokens (no database lookup for verification).

**Alternatives considered:**
1. **Database-backed unsubscribe tokens** — requires a new table, token cleanup jobs, and lookup on every unsubscribe. Overkill for an idempotent toggle.
2. **Email queue (BullMQ, Inngest)** — adds infrastructure for a feature that sends at most one email per comment. Deferred until volume justifies it.
3. **Supabase database trigger** — harder to debug, can't access auth.users email easily, and the project convention is API-route-based notifications (per DECISIONS.md).

**Token approach:** `base64url(userId).HMAC-SHA256(userId, UNSUBSCRIBE_SECRET)` — mirrors the CLI auth token pattern in `lib/api/cli-auth.ts`. No expiry needed because unsubscribe is idempotent and non-destructive.

## @Mention Tagging: Any User Mentionable, Autocomplete for Followed (2026-02-18)

**Decision:** Any valid `@username` creates a mention notification. The autocomplete dropdown only suggests followed users (convenience, not enforcement).

**Alternatives considered:**
1. **Only followed users can be mentioned** — too restrictive, prevents cross-community interaction.
2. **Global user search in autocomplete** — privacy concern (leaks usernames), heavier query load. Deferred to V2 if needed.
3. **Diff old-vs-new mentions on description re-save** — prevents duplicate notifications on re-save but adds complexity. Accepted as V1 tradeoff.

**De-duplication rule:** When a user comments on someone's post and also @mentions the post owner, the post owner gets only the "comment" notification (not a redundant "mention").

## Supabase Security Hardening: Defense-in-Depth Grants (2026-02-18)

**Decision:** Revoked all excess table-level grants from `anon` and `authenticated` roles. `anon` is now SELECT-only on every table. `authenticated` gets only the specific privileges its RLS policies actually allow (e.g., `users` gets SELECT+UPDATE, `posts` gets SELECT+INSERT+UPDATE+DELETE).

**Problem:** Supabase's default schema grants `ALL PRIVILEGES` to `anon` and `authenticated` on every table, relying entirely on RLS policies for access control. This is a single layer of defense — one misconfigured or accidentally dropped policy exposes full CRUD access to the entire table.

**Alternatives considered:**
1. **Leave defaults, trust RLS** — works until it doesn't. The Moltbook breach (1.5M credentials exposed) was exactly this: Supabase defaults + missing RLS.
2. **Restrict grants to match RLS policies** (chosen) — defense-in-depth. Even if a policy is dropped, the grant prevents unauthorized operations.

**Also fixed:** Revoked EXECUTE on all SECURITY DEFINER functions from `anon`/`authenticated`. `lookup_user_id_by_email` was callable by unauthenticated users, allowing email-to-UUID enumeration via the `auth.users` table.

## Leaderboard: Regular Views Over Materialized Views (2026-02-18)

**Decision:** Converted all four leaderboard materialized views to regular Postgres views and removed the `pg_cron` refresh jobs.

**Problem:** Leaderboard data was up to 15 minutes stale. Users who pushed a session wouldn't see their rank update immediately — bad for a product built around dopamine feedback loops.

**Alternatives considered:**
1. **Increase refresh frequency (e.g., every 1 minute)** — still not real-time, adds unnecessary cron load.
2. **Supabase Realtime subscriptions** — over-engineered for current scale; requires client-side state management.
3. **Regular views** (chosen) — queries compute on every request, but the dataset is small (~36 users, ~93 daily_usage rows). The JOIN + GROUP BY + SUM runs in under 1ms.

**When to revisit:** If `daily_usage` exceeds ~100k rows or query time exceeds ~50ms, switch back to materialized views with a shorter refresh interval.

## ccusage npx Fallback (2026-02-18)

**Decision:** When the `ccusage` binary isn't found on PATH or in well-known directories, the CLI falls back to `npx --yes ccusage` before erroring.

**Problem:** Users running `npx straude@latest` for the first time don't have `ccusage` installed globally. The CLI errored with "ccusage is not installed" — a poor first-run experience.

**Tradeoff:** The npx fallback is slower on first run (~5-10s to download ccusage) and subsequent runs still have npx overhead (~200-300ms). Users who install ccusage globally get the fast path automatically.

## ccusage Binary Resolution and Error Diagnostics (2026-02-18)

**Decision:** The CLI now resolves the `ccusage` binary via `which` first, then probes well-known global bin directories as a fallback. Error messages include diagnostic metadata (resolved path, error code, exit status, signal, PATH snippet).

**Problem:** Users reported "ccusage failed: unknown error" even with ccusage installed globally. Root cause: `execFileSync` without a shell throws `ENOENT` (a Node `SystemError` with `code: "ENOENT"`) when the binary isn't found — it does NOT set `status: 127` or populate `stderr`. The old error handler only checked `status === 127` and `stderr.includes("not found")`, so ENOENT errors fell through to the generic `error.stderr ?? "unknown error"` path. Since ENOENT errors have no `stderr`, the user saw "unknown error" with no actionable information.

**Secondary cause:** `execFileSync` inherits the Node process's PATH, which may not include directories added by nvm/volta/fnm/Homebrew in the user's shell profile (`.zshrc`). The binary exists but the CLI can't find it.

**Alternatives considered:**
1. **Spawn with `shell: true`** — would use the user's shell and source their profile, but introduces shell injection risk and portability issues.
2. **Require users to pass `--ccusage-path`** — bad UX; most users expect global installs to just work.
3. **`which` + fallback probe** (chosen) — `which` covers the common case; the probe list handles nvm/volta/fnm/Homebrew/bun/pnpm global installs.

**Error detection now covers:** `ENOENT` code, exit status 127, stderr "not found", ENOENT in message string, `EACCES` (permission denied), timeout (`killed`/`SIGTERM`). Diagnostic context is appended to every error so users can paste the full output in bug reports.

## Feed Tabs — Client-Side Switching (2026-02-18)

**Decision:** Tab switching fetches data client-side via `/api/feed?type=X` and uses `router.replace` to update the URL, rather than triggering a full server-side page reload.

**Alternatives considered:**
1. **Server-side only (router.push with `?tab=`)** — simpler, but causes a full page reload on every tab switch, making the UX feel sluggish.
2. **Client-side fetch + router.replace** (chosen) — instant tab switch with no page reload. URL still updates for shareability. SSR provides the correct initial data on direct navigation.

**Global as default:** New users previously saw an empty feed with a "find users to follow" prompt — a poor first experience. The global feed (all public users' posts) is now the default, ensuring every user sees content immediately.

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
