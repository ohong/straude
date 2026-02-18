# Changelog

## Unreleased

### Changed

- **Leaderboard updates in real-time.** Converted all four leaderboard materialized views (`leaderboard_daily`, `_weekly`, `_monthly`, `_all_time`) to regular views and removed the `pg_cron` refresh jobs. Rankings now reflect the latest data the moment a user pushes a session — no more 15-minute staleness.
- **CLI: ccusage runs via npx — no global install required.** Removed all binary resolution logic (PATH probing, nvm/volta/homebrew candidates, `which` calls). The CLI now always runs `npx --yes ccusage`, which auto-downloads ccusage if needed. This eliminates the entire class of "ccusage not installed" errors. Source trimmed from 287 to 131 lines.
- **Country selector is now a dropdown with flags.** Both settings and onboarding pages show a `<select>` with flag emoji and country name (e.g. "🇺🇸 United States") instead of a raw ISO code text input. Dropdown styling matches the `Input` component (`rounded-[4px]`, `border-border`, `bg-white`, same focus ring).
- **Suggested friends shows up to 5 users.** Bumped the query limit from 4 to 5 non-pinned candidates so the sidebar fills all 5 slots with real users.

### Added

- **Feedback link.** Fixed-position "Feedback? DM us." link in the bottom-right corner of the app layout, linking to the project's X/Twitter DMs. Hidden on mobile.

### Fixed

### Added

- **Feed tabs: Global / Following / My Sessions.** The feed now defaults to a global view showing all public users' posts, so new users see activity immediately. A tab selector at the top lets users switch between Global, Following (previous default), and My Sessions. Tabs switch client-side for speed; URL updates to `?tab=` for shareability.
- **Post hub page (`/post/new`).** New page that guides users through the create-post flow: see unedited posts, sync via CLI, or import manually. The `+` dropdown in the top header now links here instead of the raw JSON import page. Collapsed redundant "Upload Activity" / "Create Post" menu items into a single "Create Post" entry.
- **Roadmap expanded and prioritized.** Added three new features — Achievements & Badges, Personal Analytics Dashboard, Global Challenges — and re-sorted all nine roadmap items from lowest to highest technical lift. Notification improvements (dedicated `/notifications` page, real-time push via Supabase Realtime) formally prioritized.

### Fixed

- **Suggested Friends always shows site owner first.** The `ohong` account is now pinned as the top suggestion for every new user who hasn't followed them yet.
- **Leaderboard now stays current.** Materialized views were not being refreshed automatically (pg_cron jobs existed but views had become stale between runs). Manually refreshed all four views; users with recent activity now appear correctly.
- **Privacy setting explains its effects.** The "Public profile" checkbox in Settings now shows a live description of what public vs. private means — leaderboard visibility, post visibility, and follower-only access — so users understand the trade-off before opting out.

- **Username falsely reported as "Already taken" during onboarding.** The `check-username` endpoint didn't exclude the current user's own row. When the auth callback auto-claimed a GitHub handle, the onboarding page flagged it as taken. Now excludes the authenticated user from the uniqueness check.
- **Onboarding didn't pre-fill auto-claimed username.** If the auth callback already set the username from GitHub, the onboarding page left the field empty (only pre-filled when `!profile.username`). Now pre-fills from the existing username first, falling back to the GitHub handle suggestion.
- **Users stuck on onboarding with no way out.** The app layout hard-redirected to `/onboarding` if username was missing or onboarding incomplete. Removed the hard redirect; users can now access the app at any time.

### Changed

- **Username is now optional during onboarding.** Users can proceed without choosing a username. The field defaults to their GitHub handle if signed in with GitHub.
- **Onboarding is now skippable.** Both steps show a "Skip for now" link to `/feed`. A banner in the app layout prompts users to complete onboarding when incomplete.

### Security

- **Fixed open redirect in auth callback.** The `next` query parameter in `/callback` was used in a redirect without validation. An attacker could craft a URL like `?next=//evil.com` to redirect users to a phishing page after login. Now validates that `next` is a relative path.
- **Added security headers.** `next.config.ts` now sets `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Strict-Transport-Security` (2-year HSTS with preload), and `Permissions-Policy` (deny camera/mic/geo).
- **Fixed mutable search_path on `calculate_streaks_batch`.** Supabase security advisor flagged the function as vulnerable to search_path manipulation. Now pinned to `public`.
- **Fixed RLS performance on notifications.** Replaced `auth.uid()` with `(select auth.uid())` in notification policies to prevent per-row re-evaluation.

### Added (Insights-Driven Improvements)

- **Post-edit TypeScript hook.** `.claude/settings.json` now runs `tsc --noEmit` after every Edit/Write, catching type errors immediately instead of at build time.
- **CLAUDE.md guardrails.** Added Scope, Security, and Design System sections to prevent recurring friction: scope creep, hardcoded keys, and design guideline violations.
- **`/ui-review` custom command.** `.claude/commands/ui-review.md` — checks modified components against the design system before committing.
- **CLI test suite.** `packages/cli/__tests__/` — tests for arg parsing, sync command, push command, and auth/config management.
- **CLI README.** `packages/cli/README.md` — usage docs for npm.
- **GitHub Actions CI.** `.github/workflows/ci.yml` — runs build, vitest, and Playwright on push/PR.
- **Turbo `test` task.** `turbo.json` now includes test in the task graph.
- **Committable pre-push hook.** `.githooks/pre-push` — runs test suite before push. Enable via `git config core.hooksPath .githooks`.

### Fixed (Insights-Driven Improvements)

- **`suppressHydrationWarning` on timeAgo timestamps.** ActivityCard, TopHeader, and CommentThread timestamp elements no longer risk hydration mismatches from `Date.now()` drift.

### Added

- **Open Graph & Twitter Card metadata.** Shareable links now render a rich preview with "STRAUDE" and "Strava for Claude Code" over the hero background. Includes `og:title`, `og:description`, `og:image` (1200x630), `og:type`, `og:site_name`, `og:locale`, `twitter:card=summary_large_image`, and `twitter:image`.
- **`opengraph-image.tsx` and `twitter-image.tsx`** — statically generated at build time via Next.js `ImageResponse` with Inter Bold/Medium fonts and the `hero-bg.jpg` background.
- **`apple-icon.tsx`** — 180x180 apple-touch-icon with the orange trapezoid on black.
- **`metadataBase`** set to `https://straude.com` so all OG image URLs resolve as absolute.
- **`viewport` export** for `themeColor` (moved from deprecated `metadata.themeColor`).

### Fixed

- Landing page `<title>` no longer duplicates "Straude" (`Straude — Strava for Claude Code | Straude` → `Straude — Strava for Claude Code`).

### Changed

- **Leaderboard shows output tokens, not total tokens.** All four materialized views (`leaderboard_daily`, `_weekly`, `_monthly`, `_all_time`) now sum `output_tokens` instead of `total_tokens`. Column renamed from `total_tokens` to `total_output_tokens`. Header label changed from "Tokens" to "Output".
- **Leaderboard shows live streak for each user.** New `calculate_streaks_batch(UUID[])` SQL function computes streaks for all visible users in a single RPC call. Streak column now shows actual day counts (e.g. "8d") instead of null/"-".

#### Web Interface Guidelines Compliance
- **prefers-reduced-motion support.** All animations and transitions now respect `prefers-reduced-motion: reduce`. Users who prefer reduced motion see instant state changes.
- **Replaced all `transition-all` with specific properties.** Navbar, Hero CTA, copy button, CTA section link all now transition only the properties that change (filter, box-shadow, border-color, background-color, color).
- **`text-wrap: balance` on all landing headings.** ProductShowcase, Features, HowItWorks, WallOfLove headings now balanced.
- **`tabular-nums` on numeric displays.** Stats counters, sidebar totals, leaderboard costs, and ActivityCard usage stats now use tabular figures for alignment.
- **Proper ellipsis characters.** All loading states (`Loading…`, `Saving…`, `Searching…`, `Checking availability…`) and placeholders now use `…` instead of `...`.
- **Search query reflected in URL.** `/search?q=term` enables deep-linking and back-button support.
- **Feed empty state uses `<Link>`.** Replaced `<a>` with Next.js `<Link>` for client-side navigation.

#### Accessibility Fixes
- **aria-labels on all icon-only buttons.** TopHeader bell ("Notifications"), profile ("Profile menu"), plus ("Create new"). All with `aria-expanded` for dropdown state.
- **aria-hidden on decorative icons.** All lucide-react icons that accompany text labels, Hero/CTA arrow SVGs, MobileNav icons, ActivityCard action icons.
- **focus-visible ring on all interactive elements.** Button component, landing page links/CTAs, TopHeader dropdowns, onboarding select. Uses `focus-visible:ring-2 focus-visible:ring-accent`.
- **Form labels connected to inputs.** All settings and onboarding form fields now have `htmlFor`/`id` pairs, `name` attributes, and appropriate `autocomplete` values.
- **Search input typed as `type="search"`** with `name="q"` and `aria-label="Search users"`.

#### React Performance Optimization
- **Dynamic import for react-markdown.** ActivityCard no longer loads the markdown parser in the initial bundle. Loaded on demand via `next/dynamic`.
- **Parallelized API waterfalls.** `GET /api/posts/[id]` now fetches post + kudos status in parallel. RightSidebar fetches leaderboard + following list in parallel. Leaderboard page fetches entries + user profile in parallel.
- **Stable FeedList infinite scroll.** Replaced `loading` state dependency in `loadMore` callback with a ref, preventing IntersectionObserver teardown/recreation on every load.

#### Image Optimization
- **Explicit width/height on all `<img>` tags.** ActivityCard avatars (40x40), post images (600x400), WallOfLove avatars (44x44), RightSidebar avatars (32x32).
- **`loading="lazy"` on below-fold images.** Post images, testimonial avatars, and sidebar avatars lazy-loaded.

#### Metadata
- **`color-scheme: light` and `theme-color` meta tags** added to root layout for native UI theming.

### Added

- **Notifications system.** Backend: `notifications` table with RLS (select/update own), indexes, and `follow`/`kudos`/`comment` types. API routes (`GET /api/notifications`, `PATCH /api/notifications`). Frontend: bell icon dropdown in top header with unread badge, notification list with actor avatars, time-ago timestamps, and mark-all-read. Notifications inserted from existing follow, kudos, and comment API routes (self-notifications skipped).
- **Profile dropdown in top header.** Replaced the plain avatar link with a dropdown containing View Profile, Settings, and Log out actions. Logout moved from sidebar to header.

### Changed

- **Sidebar shows 3 latest activities.** Expanded from 1 to 3 latest posts, each clickable. Section renamed "Latest Activities".
- **Logout removed from sidebar.** Moved to the profile dropdown in the top header for better discoverability.

### Fixed

- **`calculate_user_streak` RPC returned 0 due to UTC date mismatch.** The function started from `CURRENT_DATE` (UTC). If the user hadn't logged anything for the current UTC date yet, it returned 0 immediately. Now falls back to `CURRENT_DATE - 1` before giving up, fixing the streak display for users in non-UTC timezones.

### Production Readiness (multi-agent review)

#### Code Simplification
- **Deduplicated `useInView` hook.** 5 identical copies across landing components → single shared `lib/hooks/useInView.ts`.
- **Deduplicated `formatTokens` utility.** 3 copies across app components → single shared `lib/utils/format.ts`.
- **Simplified image grid logic in ActivityCard.** Redundant identical conditionals collapsed.

#### Security Fixes
- **Fixed service client env var** to match `.env.local` (`SUPABASE_SECRET_KEY`). The new Supabase key model uses publishable + secret keys, not the legacy `anon`/`service_role` keys.
- **Fixed private user data leak** in `/api/users/[username]/contributions`. Any caller could read any user's full contribution graph regardless of `is_public`.
- **Fixed SSRF in `/api/ai/generate-caption`**. Arbitrary URLs were passed to Anthropic; now validates against Supabase storage origin.
- **Added rate limiting** on `/api/auth/cli/init` (5 req/min per IP).
- **Fixed search exposing private users** in `/api/search`. Now filters to public profiles with safe field projection.
- **Added input validation** on `PATCH /api/posts/[id]` (title 100 chars, description 500, max 4 images).
- **Secured CLI config file permissions** to `0o600` (owner-only).

#### QA Fixes
- **Deleted conflicting `middleware.ts`** that broke the Next.js 16 build (project uses `proxy.ts`).
- **Added error handling for Anthropic API** in generate-caption route (now returns 503 on failure).
- **All routes verified**: every page and API route checked for auth guards, error states, and missing handlers.

### Changed

- **Strava-inspired layout rearchitecture.** Replaced the left navigation sidebar with a user profile card showing avatar, follow counts, streak, and latest activity. Added a new top header bar with brand, nav links (Feed/Leaderboard/Search), notifications bell, profile avatar, and a "+" dropdown (Upload Activity / Create Post). Reordered right sidebar to prioritize Suggested Friends (with inline Follow buttons) over leaderboard and weekly stats. Removed the sticky "Following" header from the feed page — navigation is now in the top header.
- **Larger feed images.** Removed the 300px max-height constraint on ActivityCard images. Single images now go up to 500px, grid images up to 400px, with rounded corners.
- **Landing page CTA changed to "Start Your Streak".** Replaced "Start Logging" with a CTA that references the streak mechanic — core to the product's value prop.
- **WallOfLove heading updated.** "Locked in." replaced with "Everybody is Claudemaxxing. Are you?" per user feedback.
- **Terminal mockup updated.** Command changed from `npx straude@latest push` to `bunx straude`. URL changed to `straude.com/u/ohong/feb-18`.
- **CLI snippet in hero is now a copy-to-clipboard button.** Replaced the faint `text-white/30` span with a visible bordered pill (`npx straude@latest`) that copies to clipboard on click, with a check icon confirmation state.
- **HowItWorks CLI reference updated.** Step 1 code changed from `npx straude@latest push` to `bunx straude`.

### Added

- **Vercel Analytics.** Installed `@vercel/analytics` and added `<Analytics />` to the root layout. Tracks page views across all routes automatically.

### Changed

- **Landing page copy rewritten with athletic/endurance theme.** Replaced generic startup language ("Flex your wins", "Everything you need to flex your usage") with training-log vocabulary ("Every session counts.", "Built for the daily grind", "Log your output"). CTAs changed from "Get Started — It's Free" to "Start Logging".
- **"Social proof" section label removed.** Internal jargon was exposed to users. Section heading changed from "Everyone is Claudemaxxing" to "Locked in." — no label above it.
- **Generic section labels removed.** "The product" and "Features" labels stripped from ProductShowcase and Features sections. Headings carry the hierarchy on their own.
- **CTA section tightened.** "Ready to show the world what you're building?" replaced with "Your move." Sub-copy shortened.

### Fixed

- **Hydration mismatch in ProfileMockup.** `Math.random()` generated different contribution graph data on server vs client, causing React hydration errors. Replaced with deterministic static data (`CONTRIBUTION_CELLS` constant).

### Added

- **Playwright e2e test suite.** `apps/web/e2e/landing.spec.ts` with 3 tests: hydration error detection (console listener), hero content assertion, and "Social proof" label regression guard. Config in `apps/web/playwright.config.ts`.
- **Project CLAUDE.md.** Documents stack, conventions, documentation workflow, SSR rules, and landing page voice guidelines.

---

## 0.1.1 (2026-02-18)

### Changed

- **Default command is now smart sync.** Running `npx straude@latest` or `bunx straude` with no arguments will:
  1. Authenticate via browser if not logged in (equivalent of `straude login`).
  2. Push new stats since the last push (diff-based, capped at 7 days).
  3. Print "Already synced today" if already up to date.
- **`push` now tracks `last_push_date`.** After a successful push, the latest pushed date is saved to `~/.straude/config.json` for incremental sync.
- **Updated help text.** Default usage is now `straude` (no subcommand). Examples updated to show `npx straude@latest` as the primary invocation.
- **Arg parsing refactored.** Command detection separated from flag parsing; unknown flags no longer treated as commands.
- **"Already synced" now previews today's stats.** When already synced, the CLI runs ccusage and prints today's cost/tokens/models before the "Already synced today." message, so users always see their current stats.

### Added

- `src/commands/sync.ts` — Default sync command combining login + incremental push.
- `lib/auth.ts: updateLastPushDate()` — Helper to persist the last push date.
- `lib/auth.ts: StraudeConfig.last_push_date` — Optional field for tracking push history.
- `__tests__/commands/sync.test.ts` — Tests for sync command (6 cases).
- `__tests__/flows/cli-sync-flow.test.ts` — Integration flow tests (25 cases) mocking only at boundaries (fetch, fs, ccusage binary). Covers: full sync flows, API error handling (404/401/500/network), endpoint path verification, `--api-url` override, config persistence, ccusage failures.
- `"main"` field added to `package.json` — fixes npm stripping the `bin` entry during publish on ESM packages.

### Fixed

- **`--api-url` now overrides stored config URL for all commands.** Previously, `--api-url` only applied during login; subsequent pushes used the URL saved in `~/.straude/config.json`. Now `syncCommand` and `pushCommand` (via index.ts) respect the flag, fixing 404s when the dev server runs on a different port than the one used during login.
- Date arithmetic in CLI now uses local-time parsing to avoid UTC/local timezone off-by-one errors.
