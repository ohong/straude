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

## Global Challenges

Community-wide goals that all users contribute to collectively, like "Race to 1 Billion Output Tokens." A challenge has a target metric, a deadline, and a live progress bar visible to everyone. Individual contributions are attributed and ranked within each challenge. Requires a `challenges` table, a `challenge_contributions` view aggregating from `daily_usage`, a challenge detail page with progress visualization, and a mechanism to create/schedule new challenges.
