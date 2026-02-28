# Architecture & Design Decisions

## Codex Integration: Merged Data, Not Separate Rows (2026-02-27)

**Decision:** Claude and Codex usage on the same day are merged into a single `daily_usage` row and a single post. Per-model costs are stored in a new `model_breakdown jsonb` column for percentage display.

**Alternatives considered:**
1. **Separate rows per source** — one `daily_usage` row for Claude, one for Codex. Simpler merge-free push, but doubles posts in the feed, complicates leaderboard aggregation, and splits the user's daily story.
2. **Merged row with model_breakdown** (chosen) — sum tokens/costs, union models, store per-model costs in JSONB. Single post per day. Feed card shows "75% Claude Opus, 25% GPT-5". Nullable column keeps existing rows valid.

**Silent skip design:** If `@ccusage/codex` is not installed or fails, the CLI silently proceeds with Claude data only. No error, no message. This prevents breaking existing users who don't use Codex.

## Streak Freeze: Grace Window Extension, Not Gap Bridging (2026-02-27)

**Decision:** Streak freezes extend the "is the streak still alive" check (initial grace window: `2 + freeze_days`) but do NOT bridge gaps in the middle of a streak. The base 2-day grace covers timezone offsets; freezes add extra buffer on top.

**Alternatives considered:**
1. **Consumable freezes that fill in gap days** — more like Duolingo, but adds state tracking (which freezes were used on which days), complicates the RPC, and creates confusing UX ("did my freeze get used?"). Over-engineered for current scale.
2. **Permanent grace extension** (chosen) — simplest correct behavior. Users earn freezes by enriching posts (max 7). The grace window grows from 2 to up to 9 days. No consumption tracking needed. Incentivizes post enrichment without adding complexity.

**Achievement streak vs display streak:** Achievement checks (7-day, 30-day) use `p_freeze_days = 0` so achievements are based on actual consecutive days. Only user-facing displays (sidebar, profile, API) include freeze benefits.

## Admin Revenue Concentration: Non-Overlapping Segments (2026-02-27)

**Decision:** The `admin_revenue_concentration` RPC returns non-overlapping segments (top_1, top_2–5, top_6–10, rest) rather than cumulative ranges. The client component accumulates segments to display cumulative percentages (Top 5 = top_1 + top_2–5).

**Alternatives considered:**
1. **Cumulative ranges in SQL** — simpler client code but overlapping data makes the stacked bar visualization incorrect (segments would sum to >100%).
2. **Non-overlapping segments** (chosen) — each user belongs to exactly one segment. Stacked bar sums to 100%. Client accumulates for the "Top 5 / Top 10" summary cards. More flexible for future visualizations.

## Admin Cohort Retention: Fixed 5-Week Window (2026-02-27)

**Decision:** Cohort retention shows weeks 0–4 (5 columns) for the last 12 signup cohorts. Fixed width keeps the heatmap readable.

**Alternatives considered:**
1. **Dynamic week columns up to current age** — older cohorts would have more columns, creating a jagged table. Harder to scan visually.
2. **Fixed 5-week window** (chosen) — consistent table shape. Null cells for cohorts too young for later weeks render as "–". Covers the critical first-month retention period.

## Auto-Title on Sync: Separate Insert/Update, Not Upsert (2026-02-27)

**Decision:** The usage submit route now uses separate insert (with auto-title) and update (without title) paths instead of a single upsert for posts. This prevents overwriting user-edited titles on re-sync.

**Alternatives considered:**
1. **Single upsert with conditional title** — Supabase upsert with `undefined` fields can still overwrite to NULL depending on column defaults. Risky.
2. **Separate insert/update** (chosen) — explicit control over which fields are set on create vs update. Slightly more code but zero ambiguity.

## Onboarding Auto-Follow: Top Weekly Spenders (2026-02-27)

**Decision:** Auto-follow the top 3 users from `leaderboard_weekly` on onboarding completion. Skip follow notifications to avoid spamming top users.

**Why weekly not all-time:** Weekly leaders are more likely to have recent posts in their feed, giving new users fresh content rather than historical posts from inactive accounts.

## Admin Dashboard: Env-Var Access Control + SECURITY DEFINER RPCs (2026-02-28)

**Decision:** Admin access is gated by an `ADMIN_USER_IDS` env var (comma-separated UUIDs) checked in the layout's server component. Data is fetched via four `SECURITY DEFINER` Postgres functions that bypass RLS, with `EXECUTE` revoked from `anon` and `authenticated` roles.

**Alternatives considered:**
1. **RLS policy with an `is_admin` column on `users`** — requires a migration, adds a privilege-escalation surface if the column is writable, and couples admin status to the database.
2. **Supabase custom claims in JWT** — requires changes to the auth flow and token generation. More correct long-term but overkill for a single-founder dashboard.
3. **Env var allowlist** (chosen) — zero-migration, easy to rotate, works with any auth provider. The layout server component checks before rendering; the RPCs are only callable by `service_role` anyway.

**Why SECURITY DEFINER RPCs:** Admin queries need to aggregate across all users (bypassing RLS). The service client already uses `SUPABASE_SECRET_KEY`, but RPCs encapsulate the query logic in Postgres and prevent ad-hoc cross-user reads from application code. Revoking `EXECUTE` from `anon`/`authenticated` ensures the functions can only be called via the service client.

**DAU/WAU/MAU:** Computed by fetching `user_id` from `daily_usage` with date filters and deduplicating in JS via `Set`. At current scale (~1k rows), this is simpler than a dedicated RPC. Revisit if `daily_usage` exceeds ~50k rows.

## Separate Email Preference for Mentions (2026-02-24)

**Decision:** Added `email_mention_notifications` (boolean, default `true`) as a separate column from `email_notifications`, giving users independent control over comment emails and mention emails.

**Alternatives considered:**
1. **Single boolean for all emails** — simpler, but users who want comment notifications but not mention spam (or vice versa) have no recourse.
2. **JSON preferences object** — a single `email_preferences` JSONB column with granular keys. More flexible but harder to query from the email-sending code paths, and overkill when there are only two notification types.
3. **Separate boolean per type** (chosen) — mirrors the existing `email_notifications` pattern. Each email-sending code path checks the relevant column. Easy to extend later by adding another boolean column.

**Email type differentiation:** The email template now has three types: `comment`, `mention` (in a comment), and `post_mention` (tagged in a post description). The in-app notification type stays `mention` for both — only the email subject/body distinguishes them.

## Mention Notification Deduplication (2026-02-25)

**Decision:** The PATCH `/api/posts/[id]` handler now (1) only runs mention notification logic when `body.description` is present in the update payload, and (2) queries existing `mention` notifications for the post before inserting, skipping users who already have one.

**Problem:** Every post save — including image reorders, title edits, or caption generation — re-inserted mention notifications for all `@username` references in the description. Users received duplicate in-app notifications on each save. Emails were deduplicated by Resend's idempotency key, but DB rows were not.

**Alternatives considered:**
1. **Diff old vs. new description to find new mentions** — more precise but requires fetching the old description before the update. Adds a read query and string-diffing logic for marginal benefit over the simpler approach.
2. **Unique constraint on `(type, post_id, user_id)` in notifications table** — prevents duplicates at the DB level but turns the insert into an upsert, and doesn't prevent the unnecessary email-sending code path from executing.
3. **Gate on `body.description` + query existing notifications** (chosen) — two simple checks that prevent both the unnecessary DB writes and the email code path. No schema migration needed.

**Supersedes:** The "Accepted as V1 tradeoff" note in the "@Mention Tagging" decision (2026-02-18) which deferred diff-based deduplication.

## Social Achievements: Separate RPC + Trigger-Based Filtering (2026-02-23)

**Decision:** Created a separate `get_social_achievement_stats` RPC (not extending the existing `get_achievement_stats`) and added a `trigger` parameter to `checkAndAwardAchievements` that filters which achievements to check and which RPCs to call.

**Alternatives considered:**
1. **Extend existing RPC** — add `kudos_received`, `kudos_sent`, `comments_received`, `comments_sent` columns to `get_achievement_stats`. Simpler migration but creates a wider query touching `daily_usage`, `kudos`, `comments`, and `posts` on every call, even when only one category is needed.
2. **No trigger filtering** — check all 33 achievements on every trigger. A single kudos toggle would fire 6 RPC calls (usage stats + streak + social stats, twice for giver + receiver). Wasteful.
3. **Separate RPC + trigger filtering** (chosen) — social triggers only call `get_social_achievement_stats`, usage triggers only call `get_achievement_stats` + `calculate_user_streak`. Each path touches only the tables it needs.

**Self-interactions:** Kudos/comments on own posts count toward achievements. The schema doesn't prevent self-kudos (only the notification is skipped), and filtering adds join complexity for negligible impact on thresholds.

**Slug convention:** Category-prefixed thresholds (`kudos-received-25`, `kudos-sent-100`, `comments-received-500`) for consistency with existing tiered achievements (`1m-output`, `10m-output`). Enables prefix-based queries and makes tier progression self-documenting in the DB.

## Achievement Stats: Supabase RPC Over Client-Side Aggregation (2026-02-24)

**Decision:** Created a `get_achievement_stats` plpgsql function that returns a single row of pre-aggregated stats (total cost, output/input/cache tokens, sessions, max daily cost, sync count, verified sync count). `checkAndAwardAchievements` now calls this RPC instead of fetching all `daily_usage` rows and reducing client-side.

**Alternatives considered:**
1. **Keep client-side aggregation** — works at current scale (~216 rows) but transfers increasingly more data as users accumulate history. Five `.reduce()` calls on the full result set.
2. **Postgres VIEW** — pre-defined but still computes on every query without caching. An RPC with `STABLE` marking gives the planner the same optimization hints.
3. **Materialized view + cron refresh** — overkill for a function called once per usage submit. Stale data risk for badges (user earns a badge but doesn't see it until next refresh).

**Why RPC:** Single network round-trip returns exactly the shape the achievement checker needs. `STABLE` lets Postgres optimize within a transaction. Granted only to `service_role` — matches the existing pattern where achievements are awarded server-side only.

**Bug fixed:** The PR's `verifiedSyncCount` incorrectly summed `session_count` for verified rows. The RPC uses `COUNT(*) FILTER (WHERE is_verified)`, which correctly counts the number of verified daily_usage rows.

## OG Font Loading: new URL() + Protocol Detection (2026-02-23)

**Decision:** Font files for OG image generation are referenced via `new URL("../assets/Inter-Bold.ttf", import.meta.url)` and loaded through a shared `lib/og-fonts.ts` module. The loader detects `file://` protocol (local dev) and uses `readFile(fileURLToPath(url))`, while production uses `fetch()`.

**Problem:** The original approach used `readFile(join(process.cwd(), "assets/..."))` which fails on Vercel because serverless functions don't bundle files referenced by `process.cwd()` paths. Switching to `fetch(new URL(...))` fixed production but broke local dev — Node.js `fetch()` doesn't support `file://` URLs.

**Alternatives considered:**
1. **`readFile` with `process.cwd()`** — doesn't work on Vercel (files not bundled into serverless function).
2. **`fetch(new URL(..., import.meta.url))` only** — works on Vercel (http:// URLs) but throws "not implemented" on local dev (file:// URLs).
3. **Protocol detection with dual loaders** (chosen) — `file://` uses `readFile`, `http(s)://` uses `fetch`. Works in both environments.

**Why `new URL()` matters:** Next.js file tracing only bundles assets referenced via `new URL("...", import.meta.url)`. This is what tells the bundler to include the .ttf files in the serverless function output.

## Landing Page: Motion for React over Custom useInView (2026-02-22)

**Decision:** Replaced the custom `useInView` hook and CSS `transition` classes with Motion for React (`motion/react`) for all landing page scroll animations. The custom `useInView` hook remains in the codebase for non-landing components (e.g. `HowItWorks.tsx`).

**What Motion enables that CSS transitions don't:**
1. **Scroll-linked parallax** — Hero background moves at 30% scroll speed, ProductShowcase cards drift at different rates. These are continuous transforms tied to scroll position, not possible with CSS `transition` + IntersectionObserver.
2. **Spring physics** — smoother, more natural entrance animations with eased cubic curves instead of CSS linear/ease-out.
3. **Custom variants with `custom` prop** — stagger delays computed per-card index without inline `style` hacks.

**Alternatives considered:**
1. **Keep custom `useInView` + CSS** — zero dependency cost but can only do binary in/out transitions, no scroll-linked continuous movement.
2. **CSS `@scroll-timeline`** — native but poor browser support as of Feb 2026.
3. **GSAP ScrollTrigger** — powerful but large bundle, commercial license for premium features.

**Why Motion:** Small bundle (tree-shakeable), React-native API (`motion.div`), first-class `useScroll`/`useTransform` for parallax, and widely adopted.

## Landing Page: No whitespace-nowrap on Mobile-Visible Text (2026-02-22)

**Decision:** Removed `whitespace-nowrap` from the CTA subtitle and replaced with `text-wrap: balance`. As a rule, no user-facing text on the landing page should use `whitespace-nowrap` unless it's within an `overflow-hidden` container or only visible on wide breakpoints.

**Why:** At 390px viewport width, the CTA subtitle ("Join motivated Claude Code builders whose work you'll love.") rendered as a 518px-wide single line, overflowing the screen. `text-wrap: balance` gives a cleaner two-line split than default wrapping.

## Recap Background: Session-Local, URL-Param Persistence (2026-02-22)

**Decision:** Background selection is session-local state (React `useState`). No DB migration. The selected background ID is encoded in the shareable URL as `?bg=03` and in the download endpoint as a query param. The OG image route reads `?bg` from the URL; defaults to `01` if not specified.

**Alternatives considered:**
1. **Store preference in user profile** — adds a column and migration for a cosmetic preference. Overkill for v1 where users pick fresh each time.
2. **Cookie/localStorage** — would persist across page loads but doesn't help with shareable links or OG images. URL params are more portable.

**Why this option:** Zero infrastructure cost, the URL is the source of truth for shared cards, and it's trivially extensible if we later add persistence.

## Achievements: Definitions in Code, Records in DB (2026-02-22)

**Decision:** Achievement badge definitions (slug, title, emoji, threshold check function) live in a typed const array in `lib/achievements.ts`. Earned records are stored in `user_achievements` (user_id, achievement_slug, earned_at). The `checkAndAwardAchievements` function runs fire-and-forget after each usage submit, fetches the user's stats, and inserts any newly earned badges.

**Alternatives considered:**
1. **Definitions in DB** — a `badge_definitions` table with thresholds. More flexible but adds a table for data that changes with code deploys, not at runtime. Thresholds are tightly coupled to the check logic.
2. **Cron-based batch check** — run a scheduled job to check all users. Unnecessary overhead when we already have the trigger point (usage submit). Users want instant feedback.
3. **Supabase database trigger on `daily_usage`** — harder to test, can't access aggregate stats cleanly in a trigger, and the project convention is API-route-based side effects.

**Why definitions in code:** Badge criteria change with feature releases, not runtime config. TypeScript gives us type-safe check functions. Adding a new badge is a single array entry — no migration needed. The DB table is just a ledger of earned records.

**RLS:** SELECT-only for all users (achievements are public). No INSERT grant for `authenticated` — awards are inserted server-side via service client to prevent users from granting themselves badges.

## Multiple CLI Syncs Per Day: Upsert Over Reject (2026-02-21)

**Decision:** Removed the client-side "already synced today" guard in `sync.ts`. When `last_push_date >= today`, the CLI now re-pushes today's data (`days: 1`) instead of returning early. The server already uses upserts on both `daily_usage` (on `user_id,date`) and `posts` (on `daily_usage_id`), so re-submitting correctly updates the data. Added a pre-upsert existence check on the server to return `action: "created" | "updated"` in the response.

**Alternatives considered:**
1. **Keep the guard but add a `--force` flag** — adds CLI surface area for what should be the default behavior. Users expect later runs to have more accurate totals.
2. **Detect data changes client-side and skip if unchanged** — unnecessary complexity. The upsert is cheap and the server is the source of truth.

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
