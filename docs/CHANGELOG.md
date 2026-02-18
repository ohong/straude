# Changelog

## Unreleased

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
- **Fixed service client env var** (`SUPABASE_SECRET_KEY` → `SUPABASE_SERVICE_ROLE_KEY`). Service-role DB operations were silently failing.
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
