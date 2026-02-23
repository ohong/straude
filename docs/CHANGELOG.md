# Changelog

## Unreleased

### Added

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
