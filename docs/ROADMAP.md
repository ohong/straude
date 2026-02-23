# Roadmap

Sorted from lowest to highest technical lift.

## Daily Digest Email (Streak Reminders + Social Nudges)

A daily email at ~6 PM local time: "Your 12-day streak is at risk — push today." Include a social nugget ("@alice gave you kudos") and leaderboard position update. The email infra already exists (React Email, Resend, notification preferences). This is the single cheapest way to bring lapsed users back — it's the **trigger** in the habit loop.

Requires: cron job (Vercel Cron or Supabase pg_cron), new email template, smart frequency logic (skip if user already pushed today), timezone-aware send time.

## Efficiency Score + Cost Forecast

Two complementary features that turn Straude from social toy into essential tool:

- **Efficiency Score** (`output_tokens / cost_usd`): a skill-based metric where a $5/day user can outrank a $50/day spender. Rewards better prompting and cache usage, not bigger wallets. Display on profiles, leaderboards, and feed cards.
- **Cost Forecast**: trailing 7-day average projected forward ("at this pace, you'll spend $420/month"). Optional budget alerts. Creates the "banking app" habit of checking your burn rate.

Both are derived math on existing `daily_usage` data — no new infrastructure. Combined, they give users a reason to check the app daily even with zero followers.

## Healthy Streaks (5-of-7) + Achievement Chains

The current strict-consecutive-day streak is an active churn driver — one missed day and everything resets. Redesign to 5-of-7 with streak freezes (Duolingo saw 21% churn reduction). Pair with restructuring the flat `ACHIEVEMENTS` array into progression quest lines with visible progress bars ("72% to 90-Day Streak"). Fixes the psychological foundation everything else builds on.

Requires: update `calculate_user_streak` / `calculate_streaks_batch` RPCs, add streak freeze logic, restructure achievement definitions into chains, add progress bar UI to profile.

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

## Team Rooms

Private or public groups where teams (company, OSS project, friend group) share a scoped leaderboard, combined contribution graph, and team streak. Highest retention potential but needs critical mass and significant build (invites, permissions, team-scoped views). Right vision for month 6-12.

---

## Shipped

### Achievements & Badges (2026-02-22)

Eight milestone badges (First Sync through 100M Output Tokens) earned progressively, displayed on profiles, checked after each usage submit. Featured Challenge ("The Three Comma Club") added to the right sidebar.

### Shareable Recap Cards (2026-02-20, redesigned 2026-02-22)

Generate branded usage summary images (weekly/monthly) for sharing on social media. Includes OG image generation for link previews (1200x630), downloadable square PNG (1080x1080) for Instagram, and a live card preview page at `/recap`. Stats include total spend, output tokens, active days, session count, streak, primary model, and a mini contribution strip. Public users get shareable URLs at `/recap/[username]`; private users can still view and download their own card.

Redesign: light theme with 10 FLUX-generated abstract backgrounds (selectable). Contribution strip caps at today (no future-day placeholders). Background choice persists in shareable URLs via `?bg=` param.
