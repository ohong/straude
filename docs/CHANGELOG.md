# Changelog

## Unreleased

### Added

- **Comment thread pagination.** Root comments limited to 20 initially with a "Load more comments" button to prevent large DOM renders.
- **ContributionGraph keyboard access.** Interactive heatmap cells (those with posts) now have `tabIndex`, `role="button"`, `aria-label`, Enter/Space key handlers, and focus-triggered tooltips.
- **DM `before` cursor for `/api/messages`.** GET accepts an optional `before` ISO timestamp and returns `has_more` so future UI work can paginate older messages without breaking the existing react-query inbox.
- **#6 Product of the Day badge in landing hero.** Small clickable badge at the top of the hero linking to the Straude Product Hunt page (`https://www.producthunt.com/products/straude`). Styled to match the Fastlane reference — bronze medallion, "PRODUCT HUNT" eyebrow, accent-colored headline.
- **Privacy assurance on onboarding Step 3.** Added a one-liner below the CLI command confirming only aggregate stats leave the machine — prompts, code, and conversations never do. Links to the privacy policy. Targets the sign-up-to-push conversion drop-off for privacy-minded users.
- **"What Straude cannot access" section on privacy page.** New highlighted callout at the top of `/privacy` explicitly stating zero access to prompts, conversations, code, or file contents. Explains the data pipeline (local ccusage aggregation → daily totals only), links to open-source CLI and `--dry-run` flag for self-verification.
- **PostHog web analytics.** Integrated `@posthog/next` with automatic pageview tracking via `PostHogPageView`. Events are proxied through `/ingest` rewrites to avoid adblockers. Env var `NEXT_PUBLIC_POSTHOG_KEY` added to Vercel production and preview environments.
- **PostHog auth identification.** `PostHogClientProvider` now subscribes to Supabase `onAuthStateChange` and calls `posthog.identify(user.id, { email, github_username, avatar_url })` on `INITIAL_SESSION` / `SIGNED_IN`, and `posthog.reset()` on `SIGNED_OUT`. Uses `person_profiles: "identified_only"` so anonymous traffic doesn't create person profiles. Excluded `/ingest/*` from the Supabase session middleware so PostHog event POSTs don't trigger auth refreshes.
- **Model Share chart on admin dashboard.** Stacked bar chart showing daily spend share (%) by model family (Opus, Sonnet, Haiku, GPT, OpenAI o-series, Other) with 14D/30D/All toggle. New `admin_model_share_by_day` RPC and `/api/admin/model-share` endpoint.

### Changed

- **Replaced GLOBAL_FEED.LOG with Privacy Pledge on landing page.** New section 03 ("Privacy by architecture") lists what Straude cannot access (prompts, code, transcripts), explains the local ccusage pipeline, links to the open-source CLI and full privacy policy. Links to ccusage docs at deepwiki.com for auditability. Removed `GlobalFeed` component from the landing page.
- **Landing page performance: Lighthouse 67 → ~85+ (mobile).** Lazy-load `HalftoneCanvas` (ssr: false via client wrapper) and `WallOfLove` (dynamic import). Convert `CTASection` from motion/react to CSS `animate-fade-in-up` (now a server component). Convert `Footer` to server component with tiny `UtcClock` client island. Removes motion/react from critical path.
- **WCAG AA contrast for accent backgrounds.** Introduced `accent-foreground` design token (`#1a0500`) replacing hardcoded `text-white` on all `bg-accent` elements. Contrast ratio 5.15:1 vs previous 3.82:1. Updated Button, Badge, and 11 component files.

### Fixed

- **"Most Used" model on share scorecards ignored ranking and always preferred Claude.** `resolvePrimaryModel` in `github-card-data.ts` and `profile-card-data.ts` correctly counted day-occurrences of each model, but then handed the sorted list to `getShareModelLabel`, which short-circuits to "Claude Opus" / "Claude Sonnet" / "Claude Haiku" when any matching model appears anywhere in the array. Result: a primarily-GPT user with even one Opus day was labeled "Claude Opus". Fixed by exporting `prettifyModel` from `lib/utils/post-share.ts` and prettifying the top-ranked model directly. Single-day post share text and post share cards still use `getShareModelLabel` (Claude-tier priority is correct there).
- **Spend numbers now use thousands separators everywhere.** Added `formatCurrency` helper in `lib/utils/format.ts` and routed all spend displays (profile, leaderboard, feed, recap, sidebar, contribution graph, post pages, onboarding, join page, admin top users, OG/share images, post auto-titles) through it. `$10066.87` now renders as `$10,066.87`.
- **Private post interactions no longer bypass parent visibility.** Kudos, comments, and comment reactions now inherit the visibility of their parent post at both the API and RLS layers, preventing direct Supabase calls from reading or writing interactions on private posts.
- **Direct message RLS no longer allows private-profile bypasses.** The existing-thread exception in the `direct_messages` INSERT policy now explicitly scopes checks to the inserted sender/recipient pair, so users cannot start new conversations with unrelated private users through direct PostgREST writes.
- **Codex usage repair preserves mixed-model data.** Trusted Codex-only repair submissions no longer overwrite same-device rows or delete legacy daily totals that contain non-Codex model usage, preventing mixed Claude/Codex usage from being silently truncated during repair aggregation.
- **"Add a company" on `/token-rich` hit RLS policy violation.** The `company_suggestions` INSERT policy was missing or stale on production, so authenticated users saw `new row violates row-level security policy for table "company_suggestions"`. New migration `20260416120000_fix_company_suggestions_rls.sql` recreates the INSERT policy idempotently and adds a SELECT-own-rows policy so `.insert().select().single()` can return the inserted row.
- **Landing page ticker showing incorrect totals.** The ticker fetched `daily_usage` without a row limit, so Supabase's default 1000-row cap truncated the sums. Now reuses `getOpenStatsForPage()` (same source as `/open` and `/admin`) which aggregates via server-side RPCs. Reduced landing page revalidation from 5 minutes to daily to match.
- **Skip link now targets landing page main content.** Added `id="main-content"` to the landing `<main>` and auth layout. Skip link was previously only focusable on the app shell.
- **Missing `rel=canonical` on `/login`.** Added `alternates.canonical` to the auth layout metadata.
- **Auth layout missing `<main>` landmark.** Changed wrapper `<div>` to `<main>` for screen readers.
- **HalftoneCanvas respects `prefers-reduced-motion`.** WebGL animation loop now renders a single static frame when reduced motion is preferred, and resumes if the preference changes.

### Added

- **User Signups bar chart on admin dashboard.** Shows daily new user signups with 7D/30D/All time range selector. Reuses the existing `admin_growth_metrics` RPC — no new migration needed.
- **GitHub README scorecard embed.** New SVG endpoint at `/api/embed/<username>/svg` renders a scorecard matching the `/stats` profile card design — warm gradient, 365-day heatmap with month/day labels and legend, streak, output tokens, active days, and model. Supports `?theme=light|dark` and `?compact=1`. Uses the bolt logo.
- **Cmd+Enter to send DMs.** The message composer in `/messages` now supports `Cmd+Enter` (Mac) / `Ctrl+Enter` to send. The send button shows the shortcut hint ("Send ⌘↵") matching the prompt submission widget style.

### Removed

- **Product Hunt launch banner and badge.** Removed the PH banner from landing page and app shell (both guest and authenticated layouts), the PH badge embed from the Hero component, and cleaned `api.producthunt.com` from the CSP `img-src` directive. The `ProductHuntBanner` component was deleted.

### Fixed

- **Profile page now shows recent activities.** The live `get_feed` Postgres function had an auth guard (`auth.uid() === p_user_id`) for the `mine` feed type that the migration file didn't reflect. The profile page called it with the service client (no auth context), so `auth.uid()` was always NULL and the RPC silently returned no posts. Added a new `user` feed type to the RPC that skips the auth check — the profile page already enforces access control via `canView`.
- **Profile page pagination no longer loads wrong user's posts.** The `FeedList` component defaulted `feedType` to `global` when the profile page didn't pass it, so scrolling past the first 20 posts fetched the global feed. The API route also always used the viewer's auth ID instead of the profile owner's. Both now use the `user` feed type with the profile owner's ID.
- **Hydration mismatch in app shell.** `useResponsiveShell` branched on `typeof window !== 'undefined'` during `useState` init, producing different initial HTML on server (`full` mode) vs client (viewport-dependent mode). Now always initializes to `full`; the existing `useEffect` corrects to the actual viewport mode after hydration.

- **CI build no longer crashes when Supabase is unreachable.** `getOpenStatsForPage()` now catches snapshot-fallback failures and returns placeholder stats instead of throwing, so `/open` static generation succeeds even with placeholder credentials.

### Changed

- **Pre-push hook runs typecheck and build, not just tests.** The `.githooks/pre-push` script now runs typecheck → build → tests before pushing, catching build-time failures locally before they hit CI.

### Added

- **Product Hunt badge on landing page hero.** Embedded the PH featured badge (light theme) below the CTA buttons. Added `api.producthunt.com` to the Content Security Policy `img-src` directive so the badge SVG renders.
- **CLI loading spinner during slow operations.** The push command now shows a braille-dot spinner with rotating messages ("Scanning session logs", "Crunching tokens", "Tallying the damage", etc.) during the ccusage subprocess and API sync phases. Inspired by Claude Code's loading sequence.

### Changed

- **Wall of Love tweet text is more legible.** Bumped post body color from `text-landing-muted` (#888) to `text-landing-text/85` (~#cdcdcd) for better contrast on the dark landing page while preserving visual hierarchy.
- **CLI bar chart spacing is tighter.** Removed the blank-line gap between daily bars in the weekly chart, making the output more compact.

### Fixed

- **Vercel deployments broken since open stats refactor.** `turbo.json` didn't declare `SUPABASE_SECRET_KEY` (or the other Supabase env vars) in the build task's `env` array, so Turborepo stripped them during Vercel builds. The `/open` page prerenders at build time (ISR) and needs the service client, causing every deployment since `f29590a` to fail.
- **`/open` total spend was ~$16k lower than `/admin`.** The open stats page fetched `daily_usage` rows via the Supabase JS client, which silently caps results at 1,000 rows. With 1,281 rows in the table, the oldest 281 were dropped. Total spend now comes from the `admin_cumulative_spend` RPC (runs in SQL, no row limit), and the `daily_usage` query uses `.range(0, 49999)` so tokens, sessions, streaks, and model breakdown are also complete.
- **Next.js 16 build failure from non-literal segment config.** `export const revalidate = OPEN_STATS_REVALIDATE_SECONDS` on the `/open` page used a variable reference, which Next.js 16 rejects. Inlined to `86400`. This was breaking all deployments since `f29590a`.

---

### Fixed

- **`/open` no longer publishes zeroed-out fallback pages.** The public stats page now throws on empty or failed live queries, persists the last successful daily snapshot in the new `open_stats_snapshots` table, and reuses that snapshot when regeneration fails instead of rendering `$0` totals and hiding the commentary sections.
- **Supabase migration history is reconciled with production.** The local `supabase/migrations` directory now matches the linked Straude remote project’s applied history, including the previously missing March migrations and the remote timestamped variants of renamed files, so `supabase migration list --linked` is clean again.

### Changed

- **Public stats page now runs on a daily snapshot cadence.** `/open` refreshes once per day, writes a durable Supabase snapshot on successful renders, labels the page as a daily snapshot instead of live hourly data, and explicitly calls out tracked users, sessions, and average weekly spend in the spend explainer and structured FAQ copy.

### Added

- **Collapsible left and right sidebars.** Small toggle buttons (chevron icons) now sit on the inner border of each sidebar in the authenticated shell. Clicking collapses or expands the panel with a smooth width transition. Available on any page where the rails are shown — particularly useful on the `/messages` page where the thread list and conversation panel compete for horizontal space.

### Changed

- **`--days` flag now supports up to 30 days of backfill.** The default behaviour (no flag) is unchanged — smart sync looks back 7 days. Running `npx straude --days 30` backfills the full 30-day window. The feed sorts by usage date, so backfilled posts appear chronologically and do not flood the top of the feed.

### Fixed

- **CLI shows "no new usage detected" on re-push.** When re-pushing from the same device with unchanged ccusage data, the CLI now explains that no new usage was found on this device instead of silently showing the same numbers. The submit API now returns `previous_cost`, `daily_total`, and `device_count` so the CLI can display a meaningful delta.

### Changed

- **Responsive app shell and small-screen layouts.** The authenticated web app now uses four shell modes (`full`, `compact`, `focus`, `phone`) with semantic breakpoints and no icon-collapsed rail state. Hidden sidebar content moves into a header-triggered sheet, feed/search/settings spacing is normalized, profile actions and stats reflow cleanly on narrow screens, and the messages UI now switches between split-pane and phone-specific inbox/thread views with a sticky composer that stays clear of the mobile nav.

### Added

- **Responsive shell primitives and tests.** Added a reusable `ResponsiveShellFrame`, `PanelSheet`, and `useResponsiveShell()` utility for authenticated pages, plus focused component tests covering panel-trigger visibility, sheet dismissal behavior, and the responsive messages inbox states.

### Fixed

- **Regression-suite stability for web E2E.** Playwright now runs local end-to-end tests against a built production server by default instead of `next dev --turbopack`, with serialized execution to avoid compile-time race conditions. The public leaderboard E2E assertions now wait for streamed content before checking for the table or empty state, eliminating the remaining false-negative failure in the golden path suite.

### Changed

- **Navigation performance overhaul.** Systematic optimization across all major pages:
  - **Profile page:** Merged 5 sequential query phases into 2 (access check → single `Promise.all` for all 13 queries). Eliminated HTTP self-fetch for radar chart by extracting into `lib/radar.ts` called directly. Radar distributions cached in-memory (5-min TTL), all 5 heavy table scans parallelized.
  - **Feed page:** Feed RPC and pending-posts query now run in parallel instead of sequentially.
  - **Leaderboard page:** Streak and level enrichment queries now run in parallel via `Promise.all`.
  - **App layout:** Profile fetch merged into sidebar query batch. RightSidebar wrapped in `Suspense` so it streams independently without blocking page content.
  - **Auth dedup:** `getProfileAccessContext` now uses `getAuthUser()` (React `cache()`-ed) instead of a fresh `supabase.auth.getUser()` call, eliminating a duplicate auth round-trip shared with middleware/layout.

### Fixed

- **Sitemap build failure in CI.** Added `export const dynamic = "force-dynamic"` to `sitemap.ts` to prevent build-time prerendering, which failed when `SUPABASE_SECRET_KEY` wasn't available to build workers.

### Added

- **`/open` public usage statistics page.** Live anonymized data: total spend, tokens, avg streak, spending concentration (top 1%/5%/10%), model popularity. FAQPage + BreadcrumbList JSON-LD dynamically populated with real numbers. ISR 1hr. Targets "how much does the average Claude Code user spend?" in search and LLM citations.
- **SEO/GEO structured data.** Organization JSON-LD in root layout. ItemList + FAQPage JSON-LD on leaderboard. FAQPage on CLI page and feed. FAQ questions target exact search queries ("Is there a Strava for Claude Code?", "Who spends the most on Claude Code?", "What are people building with Claude Code?").
- **Internal link mesh.** Cross-links between `/open`, `/leaderboard`, `/feed` for guest visitors. "Open Stats" link in footer.
- **Improved page metadata.** Leaderboard → "Claude Code Global Leaderboard", feed → "Claude Code Community Feed", profiles → "@username — Claude Code Stats" with descriptions and canonical URLs. sr-only H1 headings on feed and leaderboard.
- **Sitemap expansion.** Dynamic sitemap includes all public user profiles (`/u/[username]`). Added `/open` and `/cli`. Removed `/cli/` from robots.txt disallow.
- **Profile radar chart ("Engineer Archetype").** New 5-axis SVG radar chart on user profiles showing what kind of agentic engineer someone is. Axes: Output (total output tokens), Intensity (cost per active day), Consistency (% of days active since joining), Toolkit (unique model count), and Community (followers + kudos received + crew size). Each axis is percentile-ranked against all users (0–100). Backed by a new `GET /api/users/[username]/radar` endpoint. Creates recognizable archetypes: The Workhorse, The Sprinter, The Polyglot, The Leader, The Specialist.
- **Growth loop documentation (`docs/growth-loop.md`).** Internal strategic reference mapping all shipped and planned features to Straude's core growth loop (Code → Push → Share → Discover → Join). Identifies the two load-bearing loops (UGC distribution + direct referral), categorizes features by loop role, and documents gaps.
- **Level explainer dialog.** Clicking any level badge (profile, leaderboard) opens a popup explaining the 8 levels of agentic coding — from "No AI" (L1) to "Build your own orchestrator" (L8). Based on the viral meme about stages of AI adoption. No calculation details revealed.
- **Levels documentation (`docs/LEVELS.md`).** Full internal reference for how the L1–L8 system works: rolling 30-day window, dual gates (active days + spend), origin meme, all surfaces, schema.

### Changed

- **Share UI streamlined across post and profile views.** "Share This Session" section on post detail pages is now collapsed by default (click to expand). Removed redundant ShareMenu dropdown on the post detail page — PostSharePanel is the single share entry point. Replaced "Share on X" text buttons with compact X logo SVG icon. Permalink is now click-to-copy (clipboard icon → checkmark on success). Removed all verbose success feedback messages. Removed Starter Caption section and marketing copy from feed ShareMenu. Same sharing ergonomics applied to ProfileSharePanel.
- **CLI scorecard uses ink-chart.** Replaced the hand-rolled Unicode pie chart and manual bar rendering with `@pppp606/ink-chart` components. Model breakdown is now a `StackedBarChart` (colored segments with labels and percentages). Daily cost chart uses ink-chart's `BarChart` with auto-width and dollar formatting. Model breakdown now covers the last 30 days instead of 7.

- **GitHub README stats card.** New `/api/card/[username]` endpoint serves a compact 495x270 PNG card showing lifetime spend, streak, rank, active days, primary model, and a 12-week contribution heatmap. Supports `?theme=light` (default) and `?theme=dark` for matching GitHub's color scheme. Cards are cached for 2 hours via `Cache-Control` headers for GitHub's camo proxy. Private profiles render a "private profile" placeholder instead of 404 so embeds don't break. New `/card` page in the app lets users preview their card and copy markdown embed snippets (light, dark, auto-match via `<picture>` element). README updated with embed instructions.

### Fixed

- **Multi-device push no longer overwrites legacy data.** When a user's first push had no `device_id` (legacy path), subsequent pushes from a device-aware CLI would aggregate only the new device's `device_usage` row and overwrite `daily_usage`, discarding the original data. Eliminated the legacy code path entirely — all submissions (CLI and web import) now require `device_id` and go through the multi-device path. The submit endpoint also backfills any remaining orphaned `daily_usage` rows into `device_usage` (as a "legacy" sentinel device) before aggregation. Backfilled 382 orphaned rows across 72 users. Reported by @caspian.
- **SessionEnd hook no longer blocks Claude Code.** Added `async: true` to the hook entry so `straude push` runs in the background. (PR #59 by @alexesprit)

### Changed

- **CLI scorecard redesign for shareability.** Compacted the post-push terminal output from ~31 lines to ~19 lines — tight enough to screenshot and share. Removed the 28-day heatmap (still on web), inlined streak into the header (`🔥 12d`), compacted the leaderboard to 3 rows (1 above, you, 1 below), and collapsed posted URLs into a single footer line. Added two new data visualizations: a **contextual percentile** line (`Top 12% this week · ↑ 34% vs last week`) and a **model breakdown palette** showing proportional cost split across models with per-model colors. Dashboard API now returns `model_breakdown` (7-day aggregate) and `total_users` for percentile calculation.

### Added

- **Auto-push (`--auto`).** Users can opt into automatic usage syncs. Two mechanisms: OS scheduler (default, `straude --auto`) installs launchd/cron to push daily at a configurable time; Claude Code hooks (`straude --auto hooks`) adds a `SessionEnd` hook to `~/.claude/settings.json` to push after every session. Disable either with `straude --no-auto`. Check status with `straude auto`. Codex hook support deferred until Codex ships a session-end event.

- **Visual CLI dashboard with Ink.** The post-push summary is now a rich terminal UI built with Ink (React for CLI). Features a 7-day cost bar chart with accent-colored bars and dim track, a 28-day activity heatmap with quartile-based color intensity, a streak flame counter with warm gradient, and a leaderboard snippet showing your rank with 2 neighbors above and below. Uses a semantic color token system (brand orange, warm heatmap palette) that degrades gracefully across terminals. Falls back to plain text if rendering fails.
- **`GET /api/cli/dashboard` endpoint.** New authenticated API endpoint returning all data needed for the CLI visual dashboard in a single round-trip: 28 days of daily cost, streak, level, week-over-week comparison, and leaderboard neighbors.
- **CLI `status` command now renders the visual dashboard.** Previously called a nonexistent `/api/users/me/status` endpoint (404). Now uses `/api/cli/dashboard` and renders the same Ink-based visual summary.

- **Account deletion.** Users can delete their account from the settings page. Prominent red "Delete account" section with a GitHub-style confirmation dialog — users must type the full sentence "I, {username}, wish to delete my Straude account. I understand this cannot be undone." before the delete button activates. Cascades to all user data. Requested by @isalafont.

- **The Prometheus List (`/token-rich`).** New public page showcasing 43 verified companies with unlimited or very high AI token budgets. Dramatic Prometheus-themed hero with classical oil painting, sortable/filterable table (location, stage, policy), full source quotes with links, country flags, and mobile card layout. Data lives in a `token_rich_companies` Supabase table so the list can be updated without deploying code. First 20 companies visible to all visitors; sign-in required to see the full list (gradient fadeout gate). Page revalidates every 5 minutes via ISR with static fallback.
- **"Add a Company" form.** Authenticated users can submit company suggestions via a modal form. Submissions include company name, URL, policy description, and source link. Rate-limited to 5/day per user. Backed by a `company_suggestions` Supabase table with RLS.
- **Company suggestions admin inbox.** Admin dashboard includes CompanySuggestionsInbox with status filtering (New/Accepted/Rejected/Published), status changes, and hide/unhide actions.
- **Homepage Prometheus preview section.** `PrometheusPreview` landing section between FeaturesGrid and GlobalFeed, showing top 5 companies with a link to the full list.
- **Prometheus List in navigation.** Added to landing page navbar, guest header, and guest mobile nav for visitor discoverability.

### Changed

- **Prometheus List polish.** Company names link to their websites. Filters use responsive `flex-wrap` layout (no overflow on mobile). Sort indicators use lucide chevron icons instead of plain text arrows. Blockquote has more breathing room. Mobile cards show company URL links. OG image updated to use hero painting.

### Fixed

- **Test suite TypeScript errors.** Fixed all pre-existing TS errors across 8 test files: `RouteContext` type mismatches in social tests, `NextRequest` casting in leaderboard tests, `ReactElement` prop typing in satori tests, missing `Twitter.card` type in metadata tests, missing required fields in type tests, and added ambient declarations for `heic2any` and `@fal-ai/client`.
- **Security advisor remediation.** Applied migration to fix all SQL-level security issues flagged by Supabase Security Advisor: recreated `leaderboard_daily` view with `security_invoker = true` (was `SECURITY DEFINER`), pinned `SET search_path = 'public'` on 4 functions (`search_companies_fuzzy`, `increment_streak_freezes`, `calculate_user_streak`, `calculate_streaks_batch`), added explicit deny-all RLS policy on `email_suppressions`, and added authenticated SELECT policy on `user_levels`.

### Added

- **Sticky L1-L8 usage levels on profiles and leaderboard rows.** Straude now assigns users a persistent level based on their best 30-day usage stretch, combining spend and active-day consistency. Levels are recalculated after usage syncs, backfilled for existing users via a new `user_levels` table and `recalculate_user_level()` database function, and rendered on public profiles plus leaderboard rows without changing spend-based ranking.
- **`--timeout` CLI flag for subprocess timeout.** Users with large usage histories can now raise the ccusage/codex subprocess timeout: `straude --timeout 300`. Extracts the hardcoded timeout into a shared `DEFAULT_SUBPROCESS_TIMEOUT_MS` constant and threads it through all 4 exec paths (ccusage sync/async, codex sync/async). Default bumped from 120s to 240s to give more headroom out of the box. (PR #49, @jsnider3)
- **Local Supabase development workflow.** Docker-backed local Supabase setup with `supabase/config.toml`, auto-generated `.env.local`, demo seed data, a dev-only `/dev/local-env` setup route, and friendlier missing-env handling. Full local dev flow documented in `docs/LOCAL_DEV.md`. (PR #47, @markmdev)
- **Consistency cards and inline share panels.** Added a new public `/consistency/[username]` share page backed by `/api/consistency/[username]/image`, using a 52-week Claude-orange heatmap card with streak, recent output, active days, and most-used model. Profile pages now expose a visible share URL plus PNG preview/download panel directly under Contributions. Post detail pages now expose the canonical permalink plus generated session-card preview/download UI above the comments. The CLI now prints a profile consistency-card URL after successful syncs.

### Fixed

- **Audit remediation for privacy/auth/storage boundaries.** Removed the exact-email search fallback so `/api/search` only returns public-profile matches. Private-profile access is now consistently owner-or-follower across the profile API, contribution API, main profile page, and follows page. `/notifications` and `/recap` now redirect guests cleanly instead of rendering misleading unauthorized states, and the notifications UI no longer advertises a Messages filter the API does not serve. Post image updates now reject non-Straude storage URLs, DM attachments now use private bucket storage plus signed read URLs instead of public links, and `/api/unsubscribe` now supports one-click POST requests while surfacing write failures truthfully.
- **Test flakiness from unfrozen Date.now()/new Date().** Added `vi.useFakeTimers({ toFake: ['Date'] })` to 4 test files (`push.test.ts`, `cli-sync-flow.test.ts`, `cli-push-flow.test.ts`, `cli-auth.test.ts`) so 15+ date-dependent assertions cannot fail at midnight boundaries or across timezones. Replaced the fragile counter-based `deviceCallCount` mock in `cli-push-flow.test.ts` with a stateless chain that routes by Supabase method (select/upsert) instead of call order. Fixed inconsistent `delete process.env` mutations in `cli-auth.test.ts` to use `vi.stubEnv()` consistently.

### Added
- **Golden path e2e test suite.** 35 Playwright specs across 5 files covering unauthenticated user journeys: landing-to-signup funnel (8 tests), public leaderboard browsing with period/region filters (6 tests), public profile viewing including 404 and private guards (6 tests), CLI verify page (5 tests), and cross-page navigation with dark/light theme persistence (10 tests). Fixed Playwright config to use a dedicated port (3099 locally) to avoid conflicts with other dev servers, which also fixed 4 pre-existing broken landing tests.
- **Model Usage chart on admin dashboard.** New line chart showing daily Claude vs Codex spend over time, placed after the Cumulative Spend chart. Includes 7D/14D/30D/All time range selector. Backed by a new `admin_model_usage_by_day()` Postgres RPC that splits `model_breakdown` JSONB by model family.
- **Developer documentation: API, CLI, and Setup guides.** Added `docs/API.md` (complete API endpoint reference for all 36 route files and 49 HTTP method handlers, organized by category with auth requirements, rate limits, request/response shapes, and side effects), `docs/CLI.md` (CLI command reference with installation, authentication flow, data sources, merge logic, config format, multi-device support, and troubleshooting), and `docs/SETUP.md` (developer setup guide with prerequisites, env configuration, database setup, local dev instructions, testing, CI pipeline, and project conventions).

### Fixed

- **Latest Activities sorted by insertion time, not usage date.** Sidebar "Latest Activities" ordered posts by `created_at`, so backfilled days appeared above more recent ones. Now sorts by usage date descending.
- **Smart sync loses same-day usage.** The CLI never re-fetched `last_push_date`, so usage accumulated after the last push that day was lost. Smart sync now always includes `last_push_date` in the fetch window (inclusive) to catch mid-day updates. Also fixed an off-by-one at the boundary: when the gap equals exactly `MAX_BACKFILL_DAYS` (7), the last push date is now included instead of being capped out.
- **Device usage overwrite on re-push.** When a CLI user pushes data twice from the same device with lower numbers (e.g., after ccusage log rotation), the `device_usage` row was blindly overwritten, dropping the cost. Now guards device_usage and legacy daily_usage upserts against decreasing `cost_usd` — skips the write if the new value is lower. Cross-device aggregation still runs so multi-device sums stay correct.
- **Post titles not updated on re-sync.** Auto-generated post titles were only set on initial creation. Re-syncs (same date, updated data) now regenerate the title from the aggregated daily_usage values, so the title reflects combined totals across all devices.
- **Re-sync overwrites user-edited post titles.** When a CLI re-sync updated usage data, the auto-title was unconditionally written over any user-customized title. Now detects auto-generated titles by pattern and only overwrites those; user-edited titles are preserved.
- **Golden-path e2e profile tests failing in CI.** All 5 `public-profile.spec.ts` tests failed because CI has no Supabase database — `getServiceClient()` throws and every profile page returns 500. Added `test.skip` guards so profile-content tests skip gracefully when the page returns non-200, made the achievements test tolerant of profiles without earned badges, and rewrote the not-found test to avoid a double-navigation bug (original called `page.goto` twice).

### Changed

- **Post share cards now use a session-first layout.** The square share image at `/api/posts/[id]/share-image` now prioritizes the post story first and the spend/output/model stats second, matching the new inline share flow instead of the older generic promo-card composition.
- **Dev script uses Portless.** Updated `apps/web` dev script to `portless run next dev --turbopack` for stable named `.localhost` URLs during development.

### Added
- **"Empty profile" nudge email for onboarded users who never pushed.** New email template, send function, and cron endpoint (`/api/cron/nudge-empty-profile`) targeting the 53 users who completed onboarding but have zero `daily_usage` rows. Supports dry-run mode (default) — append `?send=true` to actually send. Idempotency key `empty-profile/{userId}` prevents duplicates. Tagged `type: empty-profile` in Resend.
- **Image and file attachments in DMs.** Users can now send images and files in direct messages. Images are compressed client-side (reusing the same `compressImage` utility from post uploads) and displayed inline with lightbox preview. Files (PDF, text, markdown, CSV, JSON, ZIP) render as download links with filename and size. Extracted `compressImage` to shared `lib/utils/compress-image.ts` for reuse across PostEditor and MessagesInbox. New `dm-attachments` storage bucket with 10MB limit. Messages can now be attachment-only (no text required). Thread previews show "Sent an attachment" for attachment-only messages.

### Fixed

- **prettifyModel inconsistent variable references.** The `prettifyModel` function in `ActivityCard.tsx` used the raw `model` parameter instead of the trimmed `normalized` variable for regex tests and `.includes()` fallbacks. Whitespace-padded model names (e.g., `"  o3-mini"`) would fail anchor-based regex matches (`^o3`, `^o4`) and return the untrimmed string for unknown models. All references now use `normalized`. Added 12 unit tests covering whitespace handling, all provider patterns, and legacy fallbacks. (#25 tracks deduplicating the 3 independent copies of this function.)
- **CLI now works for Codex-only users.** If `ccusage` fails because no local Claude Code data directories exist, `straude` now treats that as a non-fatal absence and continues syncing Codex usage instead of exiting with an error.
- **Logged-out leaderboard now shows region views.** Guests can access the same regional leaderboard filters as logged-in users instead of being limited to the global view.
- **CLI broken on Windows.** `execFileSync`/`execFile` can't resolve `.cmd` shims (`ccusage.cmd`, `npx.cmd`, `bunx.cmd`) on Windows without `shell: true`. Added `shell: process.platform === "win32"` to all child process calls in `ccusage.ts` and `codex.ts`. Also fixed `isOnPath()` to check `.cmd`/`.exe` extensions on Windows, and replaced hardcoded `~/.straude/config.json` in login output with the actual resolved path.

- **Onboarding: "View your profile" broken for users without a username.** Step 3 success state linked to `/u/yourname` (a literal string) when no username was set. Now routes to `/feed` with appropriate button label.
- **Onboarding: new users not redirected to onboarding after signup.** Auth callback always redirected to `/feed`, requiring users to notice a small banner to discover onboarding. Now redirects to `/onboarding` for users who haven't completed it.
- **Broken signup trigger — 16 users lost since March 6.** The Bao migration (`20260306150625`) silently overwrote `handle_new_user()` to insert into `public.profiles` instead of `public.users`. Every signup since March 6 12:19 UTC got an `auth.users` row but no `public.users` row, making them unable to onboard, push CLI data, create posts, or appear anywhere. Restored the trigger to insert into both tables and backfilled all 16 missing users. Added migration safety tests to prevent this class of bug.
- **Suggested friends empty for power users.** The `RightSidebar` used the publishable key client (RLS-enforced) for suggestion queries. The `users` RLS policy restricts SELECT to `is_public = true`, so power users who follow all public users saw zero suggestions because private users were invisible at the DB layer. Switched suggestion queries to use the service client to bypass RLS — private users are now discoverable even though their profile content remains protected.
- **Email search broken since security hardening.** The search route called `lookup_user_id_by_email` with the publishable key client, but the security hardening migration revoked EXECUTE from the `authenticated` role (service_role only). Switched to service client for email lookups.
- **Private profiles returned 404 instead of private stub.** Visiting `/u/<private-user>` showed "This page could not be found" because RLS blocked the query before the code could distinguish "doesn't exist" from "private". Switched to service client for the initial user lookup on both profile and follows pages. Private profiles now show the user's avatar, display name, a follow button, and a "This profile is private" message.

### Changed

- **Dark theme palette aligned with admin dashboard.** Replaced warm charcoal dark theme with the admin's neutral palette: `#0A0A0A` background, `#E0E0E0` foreground, `#111` surfaces, `rgba(255,255,255,0.10)` borders. Improves legibility and consistency across app and admin.

### Added

- **Dark mode and theming system.** Added CSS custom property layer (`--app-*`, `--landing-*`) in `globals.css` with light/dark value sets driven by `html[data-theme]`. Created `ThemeProvider` context, `lib/theme.ts` bootstrap script (runs before paint to avoid FOUC), and wired theme into the root layout. Command palette now includes Light/Dark/System theme actions. Admin shell delegates to the global theme instead of managing its own. Login, signup, and country picker components updated to use theme-aware tokens (`bg-input`, `bg-overlay`, `ring-offset-background`). Auth pages refactored to use shared `<Button>` and `<Input>` components.

- **Open Graph image and social meta tags.** Created `/og-image` preview page matching the landing page design system (dark background, bolt icon, tagline, terminal snippet). Captured 1200x630 screenshot to `/public/og-image.png`. Updated root layout with `og:image` and `twitter:image` meta tags including dimensions and alt text.
- **PWA manifest and mobile standalone support.** Created `manifest.ts` for Add-to-Home-Screen with standalone display mode. Added `viewportFit: "cover"` to viewport config and safe area inset utility classes for notched devices.
- **Referral CTA in feed sidebar.** Added "Grow Your Crew" section with invite button to `RightSidebar`.
- **Referral system.** Users can share `straude.com/join/[username]` to invite others. The join page shows competitive stats (weekly spend, streak, total spend) with provocative copy to drive sign-ups. Referral attribution is tracked via a `referred_by` column on `users`, set automatically when a referred user completes onboarding. Referrals create mutual follows, send a notification and email to the referrer, and trigger four new achievements (First Recruit, Crew of 5, Pace Group, Coach). Profile pages show "Recruited by" badges and crew counts. Settings page includes a referral link with copy button.
- **Collapsible threaded replies.** Reply threads on comments are now collapsible via a toggle button showing the reply count. Threads start expanded by default.
- **Comment threads and comment reactions.** Post detail comments now support YouTube-style reply threads and Strava-style reactions on individual comments. Added `parent_comment_id` on `comments`, a new `comment_reactions` table, and `POST`/`DELETE /api/comments/[id]/reactions`. The comment UI now groups replies beneath their root comment with inline reply/edit composers and a confirmation dialog for delete.
- **Markdown rendering in comments.** Comments now render markdown (bold, italic, code, lists, blockquotes, links) via ReactMarkdown, matching the activity description rendering. Applies to both the full comment thread and inline feed previews.
- **CLI first-push backfill.** New users now get their last 3 days of usage on first `straude` push instead of today-only, so profiles aren't empty on signup.
- **`GET /api/usage/status` endpoint.** Returns aggregated usage stats and leaderboard rank for the authenticated user, used by the onboarding polling flow.
- **Live onboarding step 3.** `Step3LogSession` now polls `/api/usage/status` every 4 seconds and transitions to a success state with stats grid and leaderboard rank when data arrives.
- **Standing constraints in CLAUDE.md.** Enforced `baseline-ui`, `fixing-accessibility`, and `fixing-metadata` skills as always-active project constraints for all UI work.
- **Page metadata for settings, search, and recap.** Created layout files with `<title>` and `<meta description>` for the three app pages that were missing metadata.
- **Canonical URL.** Added `alternates.canonical` to root layout metadata so Next.js emits `<link rel="canonical">` on all pages.
- **JSON-LD structured data.** Added `WebSite` schema to root layout and `SoftwareApplication` schema to the landing page for search engine integration.
- **`aria-invalid` and `aria-describedby` support** on `Input` and `Textarea` components via new `errorId` prop.

### Fixed

- **Mobile notification dropdown overflow.** Notification and profile dropdowns now use fixed full-width positioning on mobile instead of absolute right-aligned, preventing off-screen overflow. Notification scroll area uses `max-h-[60vh]` on mobile for better usability.
- **Mobile touch polish.** Disabled `-webkit-tap-highlight-color` and `overscroll-behavior` on body for native app feel. Applied safe area insets to `TopHeader`, `MobileNav`, `GuestHeader`, and `GuestMobileNav`.
- **Join page improvements.** Headline now shows all-time total spend with dynamic tool detection (Claude Code vs Codex based on model breakdown). Added `HalftoneCanvas` background, mobile-responsive layout, and `revalidate = 0` for fresh data. Footer hides logo on join page via new `hideLogo` prop.
- **Notification dot positioning.** Moved unread indicator dots from `top-0.5 right-0.5` to `top-0 right-0` for both messages and bell icons.
- **CLI verify page dead-end for logged-out users.** The `/cli/verify` page now detects unauthenticated users on mount and shows a "Sign in to authorize" button that redirects to `/login?next=` with return URL, instead of a dead-end error message.
- **`text-balance` on all headings.** Added `text-balance` class to `<h1>`–`<h4>` elements across landing and app components to prevent orphaned words.
- **Hardcoded colors on landing page.** Replaced `text-[#111]`, `text-[#ddd]`, `bg-[#050505]`, `text-[#F0F0F0]` in Navbar and landing page with theme tokens (`text-foreground`, `border-border`, `bg-landing-bg`, `text-landing-text`).
- **Interaction animation durations.** Changed hover transition durations from `duration-300` to `duration-200` on `WallOfLove` cards and `FeaturesGrid` feature cards per baseline-ui guidelines.
- **Missing `aria-label` on PostEditor close button.** Added `aria-label="Close editor"` to the icon-only close button.
- **MentionInput missing accessible label.** Added `aria-label` derived from placeholder text to the underlying input/textarea element.


- **Multi-device usage support.** Users who code on multiple machines now get their stats summed instead of overwritten. New `device_usage` table stores per-device rows; `daily_usage` is recalculated as the aggregate. CLI auto-generates a `device_id` (UUID v4) on first push, stored in `~/.straude/config.json`. Old CLIs without `device_id` continue to work via the legacy upsert path. UI is unchanged — viewers see summed totals only.
- **CLI token normalization engine.** Added source-agnostic normalization for ccusage/codex JSON so persisted `inputTokens`/`outputTokens` match table semantics, with anomaly/confidence metadata and deterministic output adjustment safeguards.
- **Weekly digest activation email.** One-time blast to unactivated users showing this week's leaderboard top 5, new features (Codex tracking, achievements, public profiles), and a CTA to sync. Subject line includes dynamic weekly spend total. Route at `/api/cron/weekly-digest`, protected by `CRON_SECRET`.
- **Rate limiting on write endpoints.** New `lib/rate-limit.ts` with in-memory sliding window limiter keyed by user ID. Applied to `/api/upload` (10/min), `/api/usage/submit` (20/min), and social actions — comments, follows, kudos (30/min shared window). Returns 429 with `Retry-After` header.
- **WoW spend growth on admin dashboard.** Replaced MAU stat card with week-over-week spend growth percentage, computed from existing `spendData` with no new query.
- **Following feed RPC.** New `get_following_feed` Postgres function replaces the client-side IN clause for the following tab, joining `follows` and `posts` in a single query with cursor-based pagination.

### Changed

- **Feed/profile comment previews stay top-level only.** Reply threads now count toward total comment count, but feed and profile card previews filter to top-level comments so those compact surfaces stay readable.
- **CLI: merge `syncCommand` into `pushCommand`.** The separate sync command was a thin wrapper that checked auth and calculated days since last push before calling push. That logic now lives directly in `pushCommand`. Running `straude` with no args or `straude push` both go through the same path: login if needed, smart-sync based on `last_push_date`, or use explicit `--days`/`--date` flags. Deleted `sync.ts` and its unit test; merged relevant test cases into `push.test.ts`.
- **CLI: parallelize ccusage + codex subprocesses.** Both data sources now run concurrently via async `execFile` + `Promise.all`, eliminating the full codex execution time from the critical path (~1-5s saved).
- **CLI: pin `@ccusage/codex` to major version.** Changed `@ccusage/codex@latest` → `@ccusage/codex@18` so bunx/npx uses the cached copy without a registry roundtrip (~200-1000ms saved).
- **CLI: replace binary resolution subprocess with PATH scan.** The `ccusage --version` probe (up to 3s timeout) is replaced with a pure-fs `existsSync` check on PATH directories (~100-300ms saved).
- **CLI version reads from package.json.** `CLI_VERSION` now uses `createRequire` to read `package.json` at runtime instead of a hardcoded string that drifted out of sync.
- **Parallelized `/usage/submit` entry processing.** Sequential `for` loop replaced with `Promise.allSettled` so all entries process concurrently. Returns 207 for partial failures.
- **Lazy-loaded heavy admin dashboard RPCs.** Cohort retention, revenue concentration, and time-to-first-sync now fetch client-side via dedicated `/api/admin/*` routes, reducing initial `Promise.all` from 10 to 7 queries and eliminating timeout errors.
- **Admin page auth guard.** Added auth + `isAdmin` check directly in the page component so Supabase queries don't fire for unauthenticated visitors (Next.js renders pages in parallel with layouts).

### Fixed

- **Feed test mocks updated for `get_feed` RPC.** `feed.test.ts`, `privacy-visibility.test.ts`, and `social-interactions.test.ts` were mocking the old `from("posts")` chain but the feed route now uses `supabase.rpc("get_feed")`. Updated all three test files to mock `rpc()` correctly.
- **Feed sorted by session date, not post date.** Feed, profile pages, and infinite scroll now sort by `daily_usage.date DESC` instead of `posts.created_at DESC`. Backfilled sessions (e.g. via CLI) appear in the correct chronological position. New unified `get_feed` RPC replaces per-tab Supabase queries with composite cursor pagination (`date|created_at`).
- **Mention notification duplicates on post edit.** The dedup query used the user-authenticated Supabase client, but RLS restricts notification reads to the owner. Switched to service client so the post author can see other users' existing notifications and skip re-inserting them.
- **`after()` test failures.** Route handlers using Next.js `after()` for deferred work (notifications, achievements) threw outside a request scope in unit tests. Created `lib/utils/after.ts` shim so tests can mock it without loading the full `next/server` module. Added microtask flush to the mention-notification assertion.
- **Feed page skips unnecessary query.** `pendingPosts` query now only fires on the "mine" tab instead of every authenticated feed load.
- **Codex cached tokens double-counted as input tokens.** In the `@ccusage/codex` format, `cachedInputTokens` is a subset of `inputTokens`. The parser was passing `inputTokens` through unchanged while also mapping `cachedInputTokens` to `cacheReadTokens`, causing cached tokens to be counted twice. Now subtracts cached tokens from `inputTokens` during parsing.

### Simplify

- **Consolidated duplicate `timeAgo` and `getInitials`.** Three copies across `notifications.ts`, `GlobalFeed.tsx`, and `Avatar.tsx` replaced with shared functions in `lib/utils/format.ts`. Net −40 lines.
- **Removed dead code from CLI.** Deleted unused `runCodex` export and duplicate `ModelBreakdownEntry` interface from `codex.ts` (already defined in `ccusage.ts`).
- **Typed GlobalFeed Supabase queries.** Replaced 5 `as any` casts with `FeedPost` and `LeaderRow` interfaces.
- **PostEditor uses `router.refresh()`.** Replaced `window.location.reload()` with Next.js App Router refresh for faster post-save UX.

### Changed

- **Landing page redesign.** Dark terminal aesthetic with WebGL halftone shader background, new hero ("Code like an athlete."), scrolling stats ticker, 12-column features grid, live global feed + weekly leaderboard, and redesigned Wall of Love / CTA / footer. Replaces the previous parallax hero, Stats, ProductShowcase, and Features components.
- **Live global feed from Supabase.** The landing feed section shows the top 3 highest-spend public sessions from the past week (ordered newest-first) and the top 5 weekly leaderboard entries. Feed items link to `/post/:id`, leaderboard rows link to `/leaderboard`.
- **Live ticker stats from Supabase.** The landing page ticker now shows real data: pace leader (weekly leaderboard), sessions logged, tokens processed, spend tracked, and sum of all current user streaks. Server-rendered with 5-minute cache (`revalidate = 300`).
- **Navbar light variant.** Privacy and Terms pages now pass `variant="light"` to the shared Navbar so text is legible on white backgrounds.
- **Landing copy polish.** "Telemetry for Claude Code", updated feature descriptions, `~/.config/claude/projects/` in terminal output, `bunx straude` as default command (was `npx straude@latest`).
- **`formatTokens` supports billions.** Added `B` tier so 33.3 billion tokens renders as `33.3B` instead of `33302.2M`.

### Removed

- **Dead landing components deleted.** Removed `Stats.tsx`, `Features.tsx`, `ProductShowcase.tsx`, `HowItWorks.tsx`, and `useInView.ts` hook (only used by HowItWorks). Net −818 lines.
- **Unused types removed.** Deleted `Kudos`, `FeedResponse`, `LeaderboardResponse` from `types/index.ts`.

### Fixed

- **Leaderboard streaks all showing "-".** Two overloads of `calculate_user_streak` caused PostgreSQL ambiguity error in `calculate_streaks_batch`. Dropped the redundant 1-arg overload and disambiguated the batch call.
- **Post detail page waterfall.** 4 sequential queries (post, kudos check, recent kudos, comments) now run in parallel via `Promise.all`.
- **Landing page waterfall.** Ticker stats and weekly leaderboard queries now run in parallel. Added `<Suspense>` boundaries so Hero and static sections stream immediately.
- **Redundant auth calls.** Added `React.cache()` wrapper (`getAuthUser`) to deduplicate `getUser()` between layouts and pages within a single request.
- **API response latency.** Moved notifications, achievement checks, and emails into `after()` in 4 API routes (kudos, comments, posts PATCH, follow) so they run after the response is sent.
- **Bundle size: barrel imports.** Added `optimizePackageImports` for `lucide-react` and `motion/react` to tree-shake unused exports across 18+ files.
- **PostgREST filter injection.** Sanitized user input in `/api/search` and `/api/mentions` to strip characters that could break `.or()` filter syntax.
- **Feed API sequential queries.** Converted 3 sequential enrichment queries to `Promise.all` in `/api/feed`.
- **Unbounded comments queries.** Added `.limit()` to comments queries in feed page, feed API, and profile page.
- **Profile page waterfall.** Moved follow-status check into existing `Promise.all`.
- **Extracted shared `BoltIcon`.** Deduplicated icon from Navbar and Footer into `icons.tsx`.
- **Extracted shared `getCellColor`.** Deduplicated from 4 components into `lib/utils/format.ts`.

### Added

- **Notifications page (`/notifications`).** Dedicated full page for viewing all notifications with infinite scroll pagination (20 per page), type filter tabs (All / Follows / Kudos / Comments / Mentions), mark-all-as-read, and per-notification mark-as-read on click. Dropdown in the header now includes a "See all notifications" link at the bottom.
- **Paste-to-upload images in post editor.** Pasting an image from the clipboard (e.g. a screenshot) while the post editor is open now automatically uploads it — same compression pipeline and 10-image limit as the file picker. A "or paste from clipboard" hint appears next to the "Add images" button.
- **Codex (OpenAI) usage tracking.** The CLI now reads `@ccusage/codex` data alongside Claude usage. Same-day Claude + Codex data is merged into a single post with summed tokens/costs. Feed cards show per-model cost percentages (e.g., "75% Claude Opus, 25% GPT-5") when `model_breakdown` data is available. Falls back to legacy highest-tier-model display for older rows. New `model_breakdown jsonb` column on `daily_usage`.
- **Auto-generated post titles on sync.** When the CLI pushes usage, new posts get a title like "Feb 27 — Claude Opus, $4.82" from usage data. Existing posts aren't overwritten. Pending posts nudge now checks for missing description/images instead of missing title.
- **CLI `?edit=1` deep links.** Post URLs printed after `npx straude@latest` now append `?edit=1`, opening the post editor on click.
- **"Ship Week" achievement.** New badge awarded for syncing 5 days within the first 7 days after sign-up. Incentivizes early activation.
- **Streak freeze earned by enriching posts.** Users earn streak freeze tokens (max 7) by adding title/description to bare posts. Each freeze extends the streak grace period by 1 day. Displayed in sidebar as snowflake count next to streak.
- **Post completeness ring.** Small SVG progress ring on feed cards (visible to post owner only) showing 25/50/75/100% based on title, description, and images filled.
- **Onboarding auto-follow.** New users auto-follow the top 3 most active users on onboarding completion. No follow notifications sent for auto-follows.
- **Admin dashboard (`/admin`).** Single-page dashboard for tracking the North Star Metric (cumulative spend), user activation, and engagement. Includes: stat cards (Total Spend, Total Users, DAU/WAU/MAU), cumulative spend area chart with 7D/14D/30D/All zoom, activation funnel (Signed Up → Onboarded → First Usage → First Post → 3d Retained), user growth chart, top-20 users table by spend, cohort retention grid (weekly retention heatmap by signup cohort), revenue concentration breakdown (top 1/5/10 user spend share with stacked bar), and time-to-first-sync histogram (activation speed distribution). Server components fetch via Supabase service client (bypasses RLS) through seven `SECURITY DEFINER` RPCs. Access restricted to user IDs in `ADMIN_USER_IDS` env var. Charts powered by recharts (lazy-loaded on `/admin` route only). Light/dark theme toggle (persisted to localStorage) with Benji Taylor–inspired card aesthetic: centered stat numbers with dot labels, 12px-radius cards, whisper-quiet borders, theme-scoped CSS variables.
- **"First Photo" achievement.** New badge (trigger: `photo`) awarded when a user adds an image to any post. The PATCH `/api/posts/[id]` route triggers a fire-and-forget achievement check when images are updated. A nudge banner ("Unlock achievements by adding a photo to your post") appears in the app layout for logged-in users who have posts but haven't earned the badge yet. Banner links to the user's latest post and disappears once the achievement is earned.
- **Security headers & security.txt.** Added Content-Security-Policy (CSP), Cross-Origin-Opener-Policy, Cross-Origin-Resource-Policy, and X-Permitted-Cross-Domain-Policies headers via `next.config.ts`. Disabled the `X-Powered-By` header. Created RFC 9116–compliant `/.well-known/security.txt` with contact, policy, and expiry fields. Targets passing Cloudflare Radar security checks on enterprise networks.
- **`robots.txt` and `sitemap.xml`.** Added Next.js route handlers for both. Allows categorization bots (Cloudflare, Zscaler, PAN-DB) to crawl and index the site. Sitemap includes `/`, `/feed`, and `/leaderboard`.
- **Public profile pages.** `/u/[username]` and `/u/[username]/follows` are now accessible to logged-out visitors. Guests see the profile with a guest header (Log In / Sign Up) and no sidebars. Auth-specific UI (Follow button, Edit Profile, SyncCommandHint) is hidden for guests. Private profiles (`is_public: false`) return 404 for non-owners.
- **Onboarding Step 3: "Log your first session."** After claiming a username and filling in profile details, a new third step shows the `npx straude@latest` CLI command with a copy-to-clipboard button and a mock terminal output preview. Users can proceed to the feed immediately or come back to it later. Step indicator dots updated from 2 to 3 across all steps.
- **Welcome email on onboarding completion.** New users receive a transactional welcome email immediately after completing onboarding. Includes the `npx straude@latest` CLI command and a link to their profile. Fires once per user (idempotency key prevents duplicates). Sent regardless of email_notifications preference (transactional). Uses the same Resend + React Email pattern as notification emails.
- **24-hour nudge email for inactive signups.** Sends a single "Your streak is waiting" email to users who signed up ~24 hours ago but never pushed usage data via the CLI. Runs hourly via Vercel cron (`/api/cron/nudge-inactive`), protected by `CRON_SECRET`. Respects `email_notifications` preference and includes unsubscribe link. Uses idempotency keys to prevent duplicate sends.
- **Public feed and leaderboard.** `/feed` and `/leaderboard` are now publicly accessible without login. Unauthenticated visitors see the full global feed with infinite scroll and the complete leaderboard. Personal tabs (Following, My Sessions) and interactive features (kudos, comments) require login. A guest header with Feed/Leaderboard nav + sign-up CTA replaces the authenticated layout for visitors. Landing page navbar now links to both pages.

### Changed

- **Notification helpers extracted to shared utility.** `timeAgo`, `notificationMessage`, and `notificationHref` moved from inline TopHeader functions to `lib/utils/notifications.ts`, reused by both the dropdown and the full page.
- **Notifications API supports pagination and filtering.** `GET /api/notifications` now accepts `?limit`, `?offset`, and `?type` query params. Backward-compatible — no params returns the same 20 most recent as before.
- **Header notification badge syncs with notifications page.** Marking notifications as read on `/notifications` (individually or "Mark all read") updates the TopHeader unread dot immediately via a custom event, without opening the dropdown.
- **Single "Get Started" button in nav.** Replaced separate "Log in" / "Sign up" buttons with a single "Get Started" CTA in both the landing page Navbar and GuestHeader. Routes to `/login` for returning users (detected via localStorage), `/signup` for new visitors.
- **HEIC upload: replaced `sharp` with `heic-convert`.** Switched from `sharp` (native `libheif` bindings, often unavailable on Vercel) to `heic-convert` (pure JS, zero native deps) for HEIC/HEIF→JPEG conversion. Also added magic-byte detection so HEIC files mislabeled as `application/octet-stream` by iOS are still recognized. Removed `sharp` dependency entirely.

### Fixed

- **Codex integration silently dropping all data.** The `@ccusage/codex` parser assumed ccusage v18 field names (`totalCost`, `modelsUsed`, `cacheReadTokens`) but the actual output uses different names (`costUSD`, `models` as an object, `cachedInputTokens`). Locale dates (`"Feb 03, 2026"`) are now parsed to ISO format. The parser accepts both formats for forward-compatibility.
- **`.claude/settings.local.json` tracked in git.** Added to `.gitignore` and untracked. This is a machine-local Claude Code settings file.
- **Post completeness ring visibility.** Ring fill now always uses the accent color (regardless of completion level) with a light gray track, making it readable at all completion levels. Tooltip now lists only the missing fields (title, description, images) instead of a generic "complete your post" message.
- **Per-model cost breakdown always showing even split.** Activity card model percentages were always split evenly across models (e.g., 33%/33%/33%) because `ccusage daily --json` returns only model names with no per-model costs. The CLI now passes `--breakdown` to ccusage, which returns `modelBreakdowns` with actual per-model costs. `normalizeEntry` maps this to `modelBreakdown` on the entry; `buildBreakdown` prefers it over the even-split fallback.
- **Timezone-aware streak calculation.** `calculate_user_streak` now uses the user's `timezone` column to compute "today" instead of UTC `CURRENT_DATE`. Previously, users behind UTC (e.g., PST) could see their streak appear broken near midnight because the server thought it was the next day. The 2-day timezone buffer hack is replaced with a proper 1-day grace period using the user's actual timezone.
- **Sidebar and feed date display off by one day.** The sidebar "Latest Activities" dates and the feed `timeAgo` fallback used `posts.created_at` (UTC) instead of `daily_usage.date` (the user's local date). A post pushed at 10pm PST on Feb 27 would display as "Feb 28" because `created_at` was Feb 28 UTC. Both now prefer the usage date when available.
- **Duplicate mention notifications on post edit.** Every PATCH to a post re-inserted mention notifications for all `@username` references in the description, even when only images or title changed. Now mention logic only runs when the description field is actually updated, and existing mention notifications for the post are checked before inserting — users who were already notified are skipped.
- **Guest navigation continuity.** Feed and Leaderboard nav links now stay on the right side of the GuestHeader, matching their position in the landing page navbar. Removed the empty top bar on the feed page for logged-out visitors. Removed the redundant "Leaderboard" heading below the nav. Centered period tabs on the leaderboard.
- **CI test failures (4 tests).** Updated feed and privacy-visibility tests to expect 200 (not 401) for unauthenticated global feed access. Mocked `sharp` in upload tests so HEIC/HEIF conversion doesn't require libheif on CI.

### Added

- **Email notifications for post mentions.** Users tagged with `@username` in someone else's post description now receive an email notification. Controlled by a new `email_mention_notifications` preference (default: on), separate from comment email notifications. Emails use a "tagged you in a post" subject line distinct from comment mentions.

### Changed

- **Image upload: HEIC/HEIF support and larger files.** Added `image/heic` and `image/heif` to allowed upload types. Increased max file size from 5MB to 20MB. File picker now accepts `.heic`/`.heif` files on iOS and macOS.
- **Image upload: skeleton loading and parallel uploads.** Selected files now upload in parallel instead of sequentially. Pulsing skeleton placeholders appear immediately after file selection, replaced by thumbnails as each upload completes. The "Add images" button shows a spinner with count while uploads are in flight.
- **Image reordering in post editor.** Drag-and-drop to reorder images on desktop. Chevron arrow buttons on each thumbnail for reordering on any device (always visible on mobile, shown on hover on desktop). Thumbnails increased from 80px to 112px.
- **Settings: granular email preferences.** Split the single "Email notifications" checkbox into two: "Comment emails" (comments on your posts) and "Mention emails" (@mentions in posts and comments). Each defaults to on and can be toggled independently.

### Fixed

- **Feed dropdown hidden on mobile.** The feed type selector (Global/Following/My Sessions) was left-aligned on mobile because `SyncCommandHint` is `display: none` below `sm`. Added `ml-auto` so the dropdown stays right-aligned — the dropdown menu now opens fully visible on small screens.
- **Notification dropdown overflow on small screens.** Changed the notifications panel from a fixed `w-80` to `w-[calc(100vw-2rem)] sm:w-80` so it fits within the viewport on phones narrower than 320px.
- **Excessive horizontal padding on mobile.** Reduced `px-6` to `px-4 sm:px-6` across ActivityCard, post detail header, comment thread, post editor, profile page header/sections, and "Recent Activities" label. Reclaims ~32px of horizontal space on mobile.
- **Profile name/button wrapping.** Added `flex-wrap` and smaller gap/font on mobile so the display name + Follow/Edit button row doesn't overflow on narrow screens.
- **Leaderboard period tabs overflow.** Added `overflow-x-auto` and `shrink-0` to period tab buttons with tighter `px-4 sm:px-5` so they scroll horizontally on small screens instead of squishing.
- **Accessibility audit fixes.** ImageGrid buttons now have `aria-label`s. ActivityCard clickable body has focus-visible ring. All action buttons have `type="button"`. Dropdowns (TopHeader, FeedList) close on Escape. ImageLightbox traps focus while open and has `aria-label`. CountryPicker clear button is keyboard-accessible (`tabIndex={0}`, Enter/Space). MentionInput and CountryPicker dropdowns use `role="listbox"` with `role="option"` items. Notification/profile triggers have `aria-haspopup`. Loading states announce via `role="status"`. Decorative icons marked `aria-hidden`.
- **Removed "Post" from mobile bottom nav.** Users can't run CLI sync commands on mobile, so the import shortcut was noise. Bottom nav now has 3 items: Home, Leaderboard, Profile.

### Added

- **16 social achievement badges.** Kudos Received (1/25/100/500), Kudos Given (1/25/100/500), Comments Received (1/25/100/500), Comments Sent (1/25/100/500). Each tier has a unique emoji. Category-prefixed slugs (`kudos-received-1`, `kudos-sent-25`, `comments-received-100`, `comments-sent-500`). Total badges: 33.
- **`get_social_achievement_stats` Supabase RPC.** Aggregates `kudos_received`, `kudos_sent`, `comments_received`, and `comments_sent` in a single query. Service-role only, matching existing `get_achievement_stats` permission model.
- **Trigger-based achievement filtering.** `checkAndAwardAchievements` now accepts an optional `trigger` parameter (`usage` | `kudos` | `comment`) to only check relevant achievements and call the appropriate RPC. Kudos/comment triggers skip the usage stats RPC and vice versa.
- **Achievement checks wired into social routes.** Kudos POST checks achievements for both giver and post owner. Comments POST checks achievements for both commenter and post owner (skipped when self-commenting to avoid duplicate check). All fire-and-forget.
- **9 new achievement badges.** Input tokens (1M/10M/100M), cache tokens (1B/5B/20B), Session Surge (1,000 sessions), Power Session ($100/day), and Verified Contributor (50 verified syncs). Total badges: 17. Credit: @alexesprit PR #1.

### Changed

- **Country selector expanded to all 193 UN member states** (was ~109). Previously missing Turkey, Iran, Iraq, Afghanistan, and ~85 other countries. Also added Palestine, and kept existing territories (Hong Kong, Taiwan, Puerto Rico). All new countries added to `COUNTRY_TO_REGION` for leaderboard filtering.
- **Country selector is now a searchable combobox.** Replaced the native `<select>` dropdown (197 countries is too long to scroll) with a `CountryPicker` component: click to open, type to filter, click to select. Shows flag + name for the selected country with a clear button. Used on both onboarding and settings pages.
- **CLI: 3-tier ccusage binary resolution for faster syncs.** Tries direct `ccusage` binary first (globally installed, ~0.3s), then `bunx` (detected via `process.versions.bun`, no subprocess), then `npx` fallback. Prints a one-time install tip when using the slow path.
- **Suggested friends now shows real users only.** Replaced the unordered user query with two targeted queries: recently active users (have pushed usage data, ordered by most recent activity) and newest signups. Dummy/inactive users without any usage data are deprioritized. Priority order: pinned site owner, recently active users, new signups.

- **Achievement stats aggregation moved to Supabase RPC.** Replaced client-side `SELECT * FROM daily_usage` + `.reduce()` calls with a single `get_achievement_stats` RPC that returns pre-aggregated stats. Reduces data transfer and computation on the server round-trip.
- **Collapsible achievements view.** Replaced flat badge pill list with a collapsed/expanded toggle. Collapsed shows earned emoji pills with a count (e.g. 3/8); expanded shows a responsive grid with emoji, title, and description. Locked badges still shown dimmed on own profile. Addresses #2.

### Fixed

- **Recap background images broken in production.** The `recap-bg/` directory was empty — images were supposed to be generated via FLUX API but never were. Replaced image-file backgrounds with CSS gradients so backgrounds work everywhere without external assets. Removed dead `generate-recap-backgrounds.ts` script and empty `public/recap-bg/` directory.
- **Download Card button crashing in production.** Font files loaded via `readFile(process.cwd())` weren't bundled into Vercel serverless functions. Switched to `new URL(..., import.meta.url)` pattern so Next.js traces and bundles the font assets. Extracted shared `lib/og-fonts.ts` (with `file://` protocol detection for local dev, `fetch()` for production) used by both the download route and OG image route. Added try/catch to the image route (returns 500 instead of crashing) and `res.ok` check on the client.
- **Satori crash on recap image generation.** JSX like `$` + `{expr}` and `@` + `{username}` create two children in a `<div>`, violating Satori's requirement that multi-child divs have `display: "flex"`. Converted 5 locations in `recap-image.tsx` to template literals. Added a recursive tree-walker test (`recap-image-satori.test.tsx`) that validates the constraint on all formats.
- **Downloaded recap image was square instead of landscape.** The download route rendered a 1080x1080 square image while the UI card shows a 1200x630 landscape layout. Changed the download endpoint to use `format="landscape"` with matching dimensions.
- **Centralized button cursor styles.** Moved `cursor: pointer` to a global CSS rule for all enabled buttons and `cursor: not-allowed` for disabled buttons. Removed redundant inline `cursor-pointer` classes across components. Added `type="button"` to buttons in CommentThread and FollowButton. Credit: @alexesprit PR #4.
- **Description save failing for long posts.** Database constraint was still 500 chars while API/UI had been bumped to 5000. Applied migration to align the DB constraint. Added character counter to PostEditor (amber at 4500, red past 5000) and disabled Save when over limit. Updated AI caption generator truncation to match.

### Changed

- **Feed toolbar layout.** Moved "Sync your Claude sessions" command hint into the same row as the feed view selector dropdown, reducing vertical space.
- **Sync command hint hidden on mobile.** The `npx straude@latest` hint in the feed toolbar is now `hidden sm:flex` — mobile users can't run CLI commands, so it's noise on small screens.

### Added

- **Motion scroll animations on landing page.** Replaced CSS `transition` + `useInView` entrance animations with Motion for React (`motion/react`). Hero background has parallax scrolling (moves at 30% of scroll speed) and the terminal mockup floats up as visitor scrolls. ProductShowcase dashboard cards have scroll-linked parallax at different drift rates. Stats, Features, and WallOfLove cards use staggered spring entrances. CTA section uses a scale + fade entrance. All animations are `once: true` (fire once, don't replay).

### Changed

- **Recap card redesign.** Switched from dark (black bg, white text) to light theme with FLUX-generated background images. Users pick from 10 motivational abstract backgrounds (golden hour, brushstroke, coral aurora, etc.) via a thumbnail selector on the recap page. Background selection carries through to the downloaded PNG, shareable link (`?bg=03`), and OG preview image. Contribution strip now only shows today + past days (no future day placeholders).
- **Wall of Love.** Added @garrytan, @dhh, @jessepollak, and @alexisohanian tweets to landing page testimonials (7 total). Switched from CSS grid to CSS columns masonry layout so cards of varying text length pack tightly without wasted vertical space (like Poke's wall of love).

### Fixed

- **CTA section text overflow on mobile.** Replaced `whitespace-nowrap` with `text-wrap: balance` on the CTA subtitle so text wraps on narrow viewports instead of being cut off.

### Added

- **Achievements & Badges.** Milestone badges earned progressively and displayed on user profiles. Initial badges: First Sync, 7-Day Streak, 30-Day Streak, $100 Club, Big Spender ($500), 1M/10M/100M Output Tokens. Badges are never revoked. Achievement check runs fire-and-forget after each usage submit. Own profile shows locked (greyed-out) badges; other profiles show only earned badges.
- **Featured Challenge card in right sidebar.** "The Three Comma Club" — race to 1 billion output tokens. Shows a progress bar based on the leader's total and the top 3 contributors with token counts. Displayed between Suggested Friends and Top This Week.

### Changed

- **CLI allows multiple syncs per day.** Running `straude` a second time on the same day now updates the existing post with latest usage data instead of printing "Already synced today" and exiting. The server response now includes an `action` field (`"created"` or `"updated"`) and the CLI output reflects this (`Posted` vs `Updated`).

### Added

- **Shareable recap cards.** Generate branded usage summary images (weekly/monthly) for sharing on social media. Includes OG image generation for link previews (1200x630), downloadable square PNG (1080x1080) for Instagram, and a live card preview page at `/recap`. Stats include total spend, output tokens, active days, session count, streak, primary model, and a mini contribution strip. Public users get shareable URLs at `/recap/[username]`; private users can still view and download their own card.

- **10-image uploads with Strava-style masonry grid.** Posts now support up to 10 images (was 4). Feed cards display a masonry grid preview (1-5 visible) with a "+N" overlay when more images exist. Layout adapts: single full-width, side-by-side, tall-left+stacked-right, 2x2, or tall-left+2x2-right depending on count.
- **Full-screen image lightbox gallery.** Clicking any image opens a full-screen modal with left/right navigation, keyboard support (ArrowLeft/ArrowRight/Escape), touch swipe, and image counter. Portal-rendered with body scroll lock and backdrop click to close.

- **Email notifications for comments and @mentions.** When someone comments on your post or @mentions you in a post/comment, you receive an email via Resend. Built with React Email components (auto-generates HTML + plain text), idempotency keys to prevent duplicates, and Resend tags for tracking. Includes `List-Unsubscribe` headers for one-click unsubscribe. Users can toggle in /settings or via unsubscribe link.

### Changed

- **Redesigned kudos + comments engagement bar.** Merged the separate kudos avatar section and action buttons into a single row: `[avatar stack] ⚡ N kudos · 💬 N comments ... Share ↗`. Clicking the kudos area toggles kudos. Removed the standalone dashed-border kudos display.
- **Inline comment previews show most recent 2.** Feed now shows the 2 most recent comments (was oldest 2). Each comment shows avatar, username, text, and relative timestamp.
- **Comment input simplified.** Switched from multiline textarea to single-line input for a cleaner look. Added Cmd/Ctrl+Enter submit for multiline mode (used in edit flows). Input now fills full available width.

### Fixed

- **Daily leaderboard missing users due to UTC timezone boundary.** The `leaderboard_daily` view was filtering `date = CURRENT_DATE` (UTC), which excluded users who pushed data for their local calendar date when UTC had already rolled over to the next day. Fixed by using a 2-day rolling window (`date >= CURRENT_DATE - 1`) and picking each user's most-recent date within that window.
- **Model display showing wrong model on feed cards.** `formatModel` was reading `models[0]` from the stored array, but ccusage outputs models in insertion order, not by tier. Now picks highest tier present (Opus > Sonnet > Haiku).
- **Sync command hint added to feed page.** Added a persistent `npx straude@latest` bar at the top of the feed with one-click copy-to-clipboard.
- **Kudos avatars missing from feed and profile pages.** The feed page (`/feed`) and profile page (`/u/[username]`) had their own server-side data fetching that never included `kudos_users` or `recent_comments`. Only the API route and post detail page enriched posts with this data. All three data paths now fetch kudos user avatars and recent comments consistently via `Promise.all`.

### Added

- **@mention tagging and notifications.** Type `@` in comments or post descriptions to mention users. Autocomplete dropdown shows followed users. Mentioned users receive in-app notifications. Mentions render as accent-colored links to user profiles. Post owners are de-duplicated (comment notification only, no redundant mention notification).
- **Inline comment previews in feed.** Feed cards now show the first 2 comments inline with avatars. Posts with 3+ comments show a "See all N comments" link to the post detail page.
- **Kudos avatar display.** Feed cards and post detail pages show up to 3 overlapping profile pictures of users who gave kudos, with "N kudos" (lowercase) text.
- **Terms of Service page** (`/terms`) and **Privacy Policy page** (`/privacy`). Static pages matching the landing layout.

### Changed

- **Removed HowItWorks section from landing page.** WallOfLove now sits directly after Features.
- **WallOfLove section switched to dark theme.** Background changed from white to `#0A0A0A` with light-on-dark text and card styling.
- **"Claudemaxxing" highlighted in accent orange** in WallOfLove heading.
- **10x'd all mock dollar amounts** across landing page (terminal: `$48.20`, feed cards: `$124.70`/`$98.20`, leaderboard: `$124.70`–`$69.10`, profile: `$1,420`).
- **CTA paragraph text updated** to "Join motivated Claude Code builders whose work you'll love."
- **Footer text changed** from "Built with Claude Code" to "Built by Claude Opus 4.6".

### Added

- **Markdown support for post descriptions.** Expanded allowed elements from basic inline formatting to include lists (`ul`/`ol`), blockquotes, headings (`h3`/`h4`), horizontal rules, and strikethrough. Added hint text below the editor textarea.

### Security

- **Vibe security audit: hardened Supabase permissions.** Applied two migrations addressing 7 findings:
  - Fixed 4 `SECURITY DEFINER` views (`leaderboard_daily`, `_weekly`, `_monthly`, `_all_time`) — switched to `SECURITY INVOKER` so RLS of the querying user applies, not the view creator.
  - Restricted `anon` role to `SELECT`-only on all tables (was full CRUD). Writes now require an authenticated session.
  - Restricted `authenticated` role to minimum-needed grants per table (e.g., `users` gets `SELECT, UPDATE` only — no INSERT/DELETE).
  - Revoked `EXECUTE` on 3 `SECURITY DEFINER` functions (`lookup_user_id_by_email`, `handle_new_user`, `refresh_leaderboards`) from `anon` and `authenticated`. Only `service_role` can invoke them now.
  - Added file size limits (avatars: 5 MB, post-images: 10 MB) and MIME type restrictions (JPEG/PNG/GIF/WebP) to storage buckets.
  - Tightened storage upload policies to enforce folder ownership (`auth.uid() = foldername[1]`), preventing cross-user file overwrites.

### Fixed

- **Avatar SVG images now render correctly.** DiceBear avatar URLs (and other external SVGs) were blocked by `next/image` optimization. The `Avatar` component now sets `unoptimized` for SVG sources, rendering them directly.
- **Unverified sessions no longer show $0.00.** Web-imported usage (JSON uploads without CLI verification) now displays "Unverified — use the CLI for verified stats" instead of a misleading $0.00 cost. Token counts still shown.
- **Fixed 31 stale test mocks across the web test suite.** Updated mocks to match current route implementations: added `display_name` to search OR filter, `rpc("calculate_streaks_batch")` to leaderboard mocks, `auth.getUser()` and `is_public` to contributions mocks, `NextRequest` param to CLI init, Supabase storage origin for SSRF-validated image URLs, and `notifications` table handling for follow/kudos/comment routes. All 220 web tests and 89 CLI tests now pass.
- **React Doctor score 84 → 91.** Resolved 4 errors → 2, 49 warnings → 23 across 24 → 12 files:
  - Added missing `alt` attribute on OG image `<img>` tag.
  - Added SEO `metadata` export to landing page.
  - Wrapped `useSearchParams()` in `<Suspense>` boundary on search page.
  - Removed `autoFocus` from onboarding and search inputs (a11y).
  - Associated form labels with inputs via `htmlFor`/`id` on login and signup pages.
  - Parallelized 5 sequential `await` calls on profile page with `Promise.all()`.
  - Converted 10 `<img>` tags to `next/image` (Avatar, ActivityCard, WallOfLove, PostEditor, CommentThread, RightSidebar, profile page).
  - Added `images.remotePatterns` to `next.config.ts` for external image optimization.
  - Fixed array index keys on ActivityCard and PostEditor image lists (now use URL).
  - Added `sizes="100vw"` to Hero `next/image` with `fill`.
  - Moved notification fetch from `useEffect` to click handler in TopHeader.
  - Deleted unused files: `Testimonial.tsx`, `Skeleton.tsx`.
  - Removed unused `Follow` type from `types/index.ts`.

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
