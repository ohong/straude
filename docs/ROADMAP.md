# Roadmap

Sorted from lowest to highest technical lift.

## Notifications Page

The dropdown shows the 20 most recent notifications. A dedicated `/notifications` page with pagination and filtering (by type) would be useful for users with high activity.

## Create Post Page

Add a dedicated `/post/new` page for composing posts directly in the app (title, description, images, model selection). Currently the "Create Post" button in the header dropdown links to `/settings/import` as a placeholder.

## Rate Limiting on Data Creation Endpoints

The CLI auth init endpoint has rate limiting (5 req/min/IP), but other write endpoints (comments, follows, kudos, upload, usage submit) do not. Consider per-user rate limiting via a shared utility or Supabase Edge Function middleware. Priority: `/api/upload` (file creation), `/api/usage/submit` (data creation), then social actions.

## Content Security Policy (CSP)

Add a strict CSP header with nonce-based script/style sources. Requires auditing all script sources (Vercel Analytics, Supabase JS client), inline styles (Tailwind), and image origins (Supabase Storage). Deferred from the security audit because a misconfigured CSP breaks the app — needs careful per-source inventory.

## Real-time Notifications

The notifications system is built but uses polling (fetch on dropdown open + initial load). Consider adding Supabase Realtime subscriptions to push new notifications to the client without requiring a page refresh or dropdown toggle.

## Achievements & Badges

Award milestone badges displayed on user profiles. Examples: First Sync, 7-Day Streak, 30-Day Streak, $100 Club, 1M Output Tokens, Night Owl (late-night sessions). Badges are earned progressively and never revoked. Requires a new `achievements` table, a check-and-award function that runs after each sync, and a badge display component on the profile page.

## Personal Analytics Dashboard

A `/stats` page showing personal usage trends over time: cost and token line charts, model usage breakdown, daily averages, busiest days of the week, and cost-per-token efficiency. All data already exists in `daily_usage` — this is primarily a frontend and visualization effort with a new API route for aggregated stats.

## Session Time Tracking

Track time spent per Claude Code session and display it per-post alongside input/output tokens and cost.

Potential approach: [claude-code-time-tracking](https://github.com/gkastanis/claude-code-time-tracking) — a script that tracks session durations and could feed into the `daily_usage` pipeline.

Requires:
- New `duration_seconds` (or similar) column on `daily_usage`
- Corresponding field in `CcusageDailyEntry` type
- CLI integration to capture and submit duration data
- UI updates to display time per post

## AI Leaderboard Commentary

Add AI-generated flavor text to leaderboard entries using Sonnet 4.6. Each entry gets a short one-liner that adds narrative context, e.g. "jayz climbed 3 spots this week on the back of a massive Opus session" or "priya_rust is on a 21-day streak and showing no signs of slowing down."

- Generated server-side when the leaderboard is rendered (or cached per refresh cycle)
- Input to the LLM: user's rank, rank change, top models used, streak length, cost delta vs. previous period
- Keep it brief (under 80 chars), punchy, and varied — avoid repetitive templates
- Only generate for the top N entries to control API cost (e.g. top 10 or top 20)

Requires: new server-side call in the leaderboard API route, caching strategy (regenerate daily or on leaderboard refresh), and a text element under each leaderboard row.

## AI Matchup Narratives

Head-to-head comparison narratives between two users on the leaderboard. When viewing another user's profile or tapping a leaderboard entry, show a short AI-generated comparison: "You and @sqb are neck-and-neck this month. You lead on sessions (23 vs 19) but they outspend you on Opus."

- Input: both users' stats for the current period (cost, tokens, sessions, models, streak)
- Tone: competitive but friendly, like a sports broadcast comparison
- Only available between public profiles
- Could be triggered on-demand ("Compare with me" button) to avoid generating for every profile view

Requires: new API endpoint (e.g. `GET /api/compare?user1=X&user2=Y`), LLM call with both users' period stats, UI placement on profile or leaderboard detail.

## CLI Recap (`straude recap`)

A new CLI command that prints an AI-generated narrative summary of the user's recent coding activity directly in the terminal.

- Fetches the user's last 7 days of `daily_usage` from the API
- Sends stats to Sonnet 4.6 with a prompt tuned for terminal output (no markdown, concise, developer voice)
- Prints a 3–5 line summary: what they worked on, spending trend, streak status, notable patterns (e.g. "Your Opus usage spiked on Wednesday — big refactor day?")
- Runs after `straude push` as an optional follow-up, or standalone via `straude recap`
- Could support `--period week|month` flag

Requires: new CLI command, new API endpoint (or reuse `/api/recap` with a `format=text` param), LLM call server-side to keep the CLI thin.

## Global Challenges

Community-wide goals that all users contribute to collectively, like "Race to 1 Billion Output Tokens." A challenge has a target metric, a deadline, and a live progress bar visible to everyone. Individual contributions are attributed and ranked within each challenge. Requires a `challenges` table, a `challenge_contributions` view aggregating from `daily_usage`, a challenge detail page with progress visualization, and a mechanism to create/schedule new challenges.

## Shareable Recap Cards

Generate a branded image card summarizing your Claude Code usage for a week or month — like Strava's post-run share card or Spotify Wrapped. Designed for sharing on Twitter/X, LinkedIn, Instagram, and group chats.

**What the card shows:**
- Hero stat: total spend for the period (the conversation-starter)
- Supporting stats: output tokens, active days out of period, session count
- Streak flame with current streak length
- Primary model used (e.g., "Claude Opus")
- Mini contribution graph strip (the "route map" equivalent — shows your usage pattern)
- Period label ("My Week in Claude Code · Feb 10–16, 2026")
- Username and straude.com URL (drives signups)

**Sharing mechanics:**
- **OG image**: `/recap/[username]?period=week` is a public page with dynamic OG metadata. Sharing the URL on Twitter/LinkedIn auto-renders the stats card as the link preview. Image generated via `next/og` ImageResponse at 1200x630.
- **Downloadable PNG**: "Download Card" button on the recap page saves a 1080x1080 PNG (Instagram/square format) to the user's device. Same data, square layout.
- Privacy-aware: only works for users with `is_public: true`. Private users see their own recap but can't generate a public URL.

**Visual design:**
- Fixed brand template: black background, white text, orange (`#DF561F`) accent on hero stat and streak flame, monospace tabular-nums for all numbers. Straude trapezoid logo top-left.
- Instantly recognizable as a Straude card (consistent branding, not user-customizable).
- Clean, high-contrast layout optimized for small previews (Twitter cards render ~500px wide).

**User flow:**
1. User navigates to `/recap` from profile or sidebar
2. Selects period: "This Week" or "This Month"
3. Sees live preview of their card with stats
4. Two actions: "Copy Link" (copies `/recap/username?period=week` URL) or "Download" (saves PNG)
5. Posts to social media → non-users see the card, visit straude.com

**Technical approach:**
- Reuse existing `next/og` ImageResponse pattern from `opengraph-image.tsx` (Inter fonts, brand assets already loaded)
- New API route for aggregated period stats: `GET /api/recap?period=week|month` — sums `daily_usage` for the period, counts active days, resolves primary model
- New page: `apps/web/app/(app)/recap/page.tsx` — client-side period selector + card preview + download/copy buttons
- New public page: `apps/web/app/recap/[username]/page.tsx` — renders the card data for OG crawlers
- New OG image route: `apps/web/app/recap/[username]/opengraph-image.tsx` — generates the 1200x630 card
- Download endpoint: `GET /api/recap/image?username=X&period=week&format=square` — generates 1080x1080 variant
- Data already exists in `daily_usage` table — no schema changes needed

**Why this drives virality:**
- Spend numbers are inherently provocative ("I spent $312 on AI this week" invites reactions)
- Streaks create FOMO and consistency signaling
- The card format is a proven viral mechanic (Strava, Spotify, Duolingo)
- Every share is a free ad with the straude.com URL
- Non-users can't generate their own card without signing up

Requires: no schema changes. Primarily frontend + 2 new API routes + OG image generation.
