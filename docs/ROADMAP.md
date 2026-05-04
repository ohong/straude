# Roadmap

Grouped by the pirate metric (AARRR) each feature primarily moves.

---

## Activation

### Team Affiliation Badge — v2

The v1 ship (2026-05-01) covers the basic "X Premium Organizations"-style affiliation: the user enters an org URL on `/settings`, we cache the favicon to Storage by domain, and a small clickable badge renders next to their @handle on profile / feed / leaderboard / sidebar. No verification, no team name, no multi-team. Follow-ups, ordered roughly by leverage:

- **Direct site scraping for the favicon** instead of always going through Google's `s2/favicons` endpoint. Try `/favicon.ico` first, then parse the HTML `<link rel="icon">` (and `<link rel="apple-touch-icon">`) for the highest-resolution variant. Independent of Google rate-limits / service deprecation, and better-quality logos for sites with proper Open Graph icons. Trade-off rationale captured in `docs/DECISIONS.md`.
- **Periodic favicon refresh.** v1 caches forever — if a company rebrands, every user's badge is stale until they re-save. A weekly cron that re-fetches favicons for all distinct domains in `users.team_url` would keep the cache fresh without per-user action.
- **Domain verification / claiming.** No verification today — anyone can claim any URL. A v2 verification flow (DNS TXT record or `/.well-known/straude-team` file) would let a real org claim their domain, with verified badges visually distinguished from unverified ones.
- **Team profile pages.** `/team/{domain}` showing every user with that team URL, leaderboard scoped to that team, and a team-only feed. Natural B2B wedge — pairs with the **Team / Org Workspaces** Acquisition entry below.
- **Multiple team affiliations per user.** People work at one place but contribute to N open-source projects. A `users → user_teams (many-to-many)` table replaces the single `team_url` column, with a primary affiliation rendered inline and the rest accessible on hover/click.
- **Custom team badge upload.** For users whose org has a non-standard logo or whose favicon is low-resolution, accept an uploaded image (size-capped, MIME-validated) that overrides the auto-cached favicon. Stored alongside the auto-cached one in `team-favicons` with a different naming scheme.
- **Save-flow Playwright e2e.** v1 ships rendering-only e2e on public surfaces (profile + leaderboard) because the repo has no auth fixture for Playwright. A follow-up should add a shared `signInAs(username)` helper (likely via Supabase admin creating a session and dropping the cookie via `page.context().addCookies`) and write the full save-flow spec the original brief asked for: sign in → /settings → enter URL → save → navigate to all four surfaces and assert the badge.

## Acquisition

### Stats Card Enhancements

The GitHub README stats card shipped as a single compact PNG. Future enhancements:

- **Shields.io-style individual stat badges** — Tiny badges for streak, rank, or total spend (e.g. `![Streak](https://straude.com/api/badge/ohong/streak)`). Useful for badge walls alongside other shields.io badges.
- **SVG variant** — Lighter payload, scalable, potential for subtle animations. Requires working around GitHub's SVG sanitization.
- **Card customization** — Custom accent color, show/hide specific stats, border radius options via query params.
- **Embed analytics** — Track how many times a card is fetched to measure backlink effectiveness.

### Team / Org Workspaces

Private groups where a company's eng team shares a scoped leaderboard, combined contribution graph, and team streak. A manager signs up, invites 10 engineers, and all 10 become users with a built-in audience. The team admin cares about the spend dashboard the same way they care about a cloud bill — this is a B2B wedge that doesn't require viral growth. Requires invites, permissions, team-scoped views, and billing context.

### AI Matchup Narratives

Head-to-head comparison narratives between two users on the leaderboard. When viewing another user's profile or tapping a leaderboard entry, show a short AI-generated comparison: "You and @sqb are neck-and-neck this month. You lead on sessions (23 vs 19) but they outspend you on Opus."

- Input: both users' stats for the current period (cost, tokens, sessions, models, streak)
- Tone: competitive but friendly, like a sports broadcast comparison
- Only available between public profiles
- Could be triggered on-demand ("Compare with me" button) to avoid generating for every profile view

Requires: new API endpoint (e.g. `GET /api/compare?user1=X&user2=Y`), LLM call with both users' period stats, UI placement on profile or leaderboard detail.

### AI Leaderboard Commentary

Add AI-generated flavor text to leaderboard entries using Sonnet 4.6. Each entry gets a short one-liner that adds narrative context, e.g. "jayz climbed 3 spots this week on the back of a massive Opus session" or "priya_rust is on a 21-day streak and showing no signs of slowing down."

- Generated server-side when the leaderboard is rendered (or cached per refresh cycle)
- Input to the LLM: user's rank, rank change, top models used, streak length, cost delta vs. previous period
- Keep it brief (under 80 chars), punchy, and varied — avoid repetitive templates
- Only generate for the top N entries to control API cost (e.g. top 10 or top 20)

Requires: new server-side call in the leaderboard API route, caching strategy (regenerate daily or on leaderboard refresh), and a text element under each leaderboard row.

---

## Activation

### Ship Week Countdown Banner

Show "4 days left — 3/5 synced" banner for users in their first week. The Ship Week achievement is live but the countdown UI is deferred. Creates urgency in the critical first 7 days.

---

## Retention / Stickiness

### Daily Digest Email

A daily email at ~6 PM local time: "Your 12-day streak is at risk — push today." Include a social nugget ("@alice gave you kudos") and leaderboard position update. Core email infra is live (React Email, Resend, notification preferences, cron-backed nudge emails), but this specific digest is not built yet. This is the **trigger** in the habit loop — cheapest way to bring lapsed users back.

Requires: cron job (Vercel Cron or Supabase pg_cron), new email template, smart frequency logic (skip if user already pushed today), timezone-aware send time.

### Healthy Streaks (5-of-7) + Achievement Chains

Streak freezes are now shipped (earned by enriching posts, extend grace window). The remaining work:

- **5-of-7 streaks**: Redesign the core streak calculation to count 5 active days out of any 7-day window instead of strict consecutive days. Requires rewriting `calculate_user_streak` and `calculate_streaks_batch` RPCs.
- **Achievement chains**: Restructure the flat `ACHIEVEMENTS` array into progression quest lines with visible progress bars ("72% to 90-Day Streak").

### Personal Analytics Dashboard

A `/stats` page showing personal usage trends over time: cost and token line charts, model usage breakdown, daily averages, busiest days of the week, and cost-per-token efficiency. All data already exists in `daily_usage` — this is primarily a frontend and visualization effort with a new API route for aggregated stats.

### Efficiency Score + Cost Forecast

Two complementary features that turn Straude from social toy into essential tool:

- **Efficiency Score** (`output_tokens / cost_usd`): a skill-based metric where a $5/day user can outrank a $50/day spender. Rewards better prompting and cache usage, not bigger wallets. Display on profiles, leaderboards, and feed cards.
- **Cost Forecast**: trailing 7-day average projected forward ("at this pace, you'll spend $420/month"). Optional budget alerts. Creates the "banking app" habit of checking your burn rate.

Both are derived math on existing `daily_usage` data — no new infrastructure. Combined, they give users a reason to check the app daily even with zero followers.

### Global Challenges

Community-wide goals that all users contribute to collectively, like "Race to 1 Billion Output Tokens." A challenge has a target metric, a deadline, and a live progress bar visible to everyone. Individual contributions are attributed and ranked within each challenge. Requires a `challenges` table, a `challenge_contributions` view aggregating from `daily_usage`, a challenge detail page with progress visualization, and a mechanism to create/schedule new challenges.

### CLI Recap (`straude recap`)

A new CLI command that prints an AI-generated narrative summary of the user's recent coding activity directly in the terminal.

- Fetches the user's last 7 days of `daily_usage` from the API
- Sends stats to Sonnet 4.6 with a prompt tuned for terminal output (no markdown, concise, developer voice)
- Prints a 3–5 line summary: what they worked on, spending trend, streak status, notable patterns (e.g. "Your Opus usage spiked on Wednesday — big refactor day?")
- Runs after `straude push` as an optional follow-up, or standalone via `straude recap`
- Could support `--period week|month` flag

Requires: new CLI command, new API endpoint (or reuse `/api/recap` with a `format=text` param), LLM call server-side to keep the CLI thin.

---

## Revenue / Monetization

### Team Rooms (Premium)

Extension of Team/Org Workspaces with premium features: private team leaderboards, spend budgets and alerts, manager dashboards with per-engineer cost breakdowns, SSO. This is the monetization path — free for individuals, paid for teams.

---

## UX Polish (from audit, Tier 4 / deferred)

### Client-side email validation before OTP send
Login form uses `type="email"` + `required` but no check for common mistakes (missing TLD, etc.) before the network request. Low effort, low impact.

### Model colors outside design system
`ActivityCard.tsx:147-158` uses hardcoded hex colors for model chips. Should be extracted to `lib/constants/model-colors.ts` for consistency.

### Typing indicators in DMs
No typing indicators in direct messages. Would require Supabase Realtime presence channels.

### Message search / filtering
No ability to search message history or filter conversations. Could use Postgres full-text search on `direct_messages.content`.

### Post/comment reporting and moderation tools
No user-facing report buttons or admin moderation queue. Requires new components, API routes, and an admin review UI.

### OG image optimization
`public/og-image.png` is 369KB PNG. Could be optimized to AVIF with PNG fallback for faster social preview loading.

## Infrastructure / Housekeeping

### Migration Drift Guardrails

The repo drifted from the remote Supabase history because several applied migrations never made it back into `supabase/migrations`, while other local files kept older timestamps for the same logical changes. Add a lightweight guardrail in CI or release tooling that runs `supabase migration list --linked` against production metadata and fails when local and remote histories diverge.

### Public Stats Snapshot Monitoring

The `/open` page now persists daily snapshots and falls back to the last good one. The next operational layer is visibility: alert when the snapshot is older than 48 hours or when the live refresh path keeps failing silently in the background. A lightweight cron or admin check could read `open_stats_snapshots`, compare the newest `snapshot_date` to today, and notify the team before the public page drifts stale.

### Per-Device Breakdown UI + Device Management

Now that `device_usage` stores per-device data, future work could expose this in the UI:

- **Per-device breakdown on post/profile pages**: Show "Work Laptop: $5.20, Home Desktop: $3.10" in an expandable section on the post detail page. Data already exists in `device_usage` — this is a read-only UI addition.
- **Device management page**: Let users view, rename, and deactivate devices. Show last active date per device. Requires a new `/settings/devices` page and a simple API route reading `device_usage` grouped by `device_id`.
- **Device inactivity alerts**: Notify users if a known device hasn't pushed in N days ("Your work-laptop hasn't synced in 5 days"). Could be part of the daily digest email.

### Cost Tracking for Non-Claude/GPT Models

`ccusage` (the upstream pricing source the CLI relies on) only ships per-token pricing for Anthropic models, so Claude Code sessions routed through DeepSeek, Qwen, Kimi, GLM, gpt-5.x-codex-spark, etc. land in `daily_usage` with `cost_usd = 0` despite real token counts. We currently surface this honestly in the UI (`ActivityCard` shows an em-dash and "Pricing soon" instead of `$0.00`), but the underlying spend is missing from leaderboards, recaps, and the North Star metric.

Options when we pick this up:
- Maintain a server-side model→pricing table on the API and recompute `cost_usd` (and per-model breakdown costs) at submit time when ccusage emits 0 but `total_tokens > 0`. Keeps a single canonical cost column. Ongoing maintenance as new models ship.
- Pull pricing from LiteLLM's `model_prices_and_context_window.json` (CC-BY-4.0) on a daily refresh job and cache it in `model_prices` so we don't hard-code rates. Same approach Helicone, OpenRouter, etc. use.
- Re-aggregate `daily_usage.cost_usd` for historical zero-cost rows once we have prices, so leaderboards backfill correctly.

Track usage of unpriced models via the existing `model_breakdown` jsonb column to prioritize which providers to add first.

### Rate Limiting on Data Creation Endpoints

The CLI auth init endpoint has rate limiting (5 req/min/IP), but other write endpoints (comments, follows, kudos, upload, usage submit) do not. Consider per-user rate limiting via a shared utility or Supabase Edge Function middleware. Priority: `/api/upload` (file creation), `/api/usage/submit` (data creation), then social actions.

## CSP Hardening (Nonce-Based)

A baseline CSP header is shipped in `next.config.ts`, but it currently allows `'unsafe-inline'`. Remaining work is to move to a strict nonce-based policy for script/style sources. Requires auditing all script sources (Vercel Analytics, Supabase JS client), inline styles (Tailwind), and image origins (Supabase Storage).

### Real-time Notifications

The notifications system is built but uses polling (fetch on dropdown open + initial load). Consider adding Supabase Realtime subscriptions to push new notifications to the client without requiring a page refresh or dropdown toggle.

### Session Time Tracking

Track time spent per Claude Code session and display it per-post alongside input/output tokens and cost.

Potential approach: [claude-code-time-tracking](https://github.com/gkastanis/claude-code-time-tracking) — a script that tracks session durations and could feed into the `daily_usage` pipeline.

Requires:
- New `duration_seconds` (or similar) column on `daily_usage`
- Corresponding field in `CcusageDailyEntry` type
- CLI integration to capture and submit duration data
- UI updates to display time per post

---

## Shipped

### Auto-Push via OS Scheduler (2026-03-22)

`straude --auto` installs a daily OS scheduler (launchd on macOS, cron on Linux) to run `straude push` at 21:00 by default. Custom time via `--time HH:MM`. Disable with `--no-auto`. Status/logs via `straude auto` subcommand. Wrapper script captures PATH at enable-time and falls back through `straude` → `bunx` → `npx`.

### Create Post Hub Page (2026-02-18)

Dedicated `/post/new` flow is live. The "Create Post" action now routes to a post hub instead of the raw import page, with quick paths to edit recent unedited posts, sync via CLI, or import manually.

### Security Headers + Baseline CSP (2026-02-26)

Security headers are live in `next.config.ts`, including Content Security Policy, COOP, CORP, and `X-Permitted-Cross-Domain-Policies`. `X-Powered-By` is disabled and `/.well-known/security.txt` is shipped. Follow-up hardening to strict nonce-based CSP is tracked above.

### Admin Dashboard (2026-02-28)

Internal dashboard at `/admin` for tracking the North Star Metric (cumulative spend), user activation funnel, growth metrics, and top users. Access restricted via `ADMIN_USER_IDS` env var. Four SECURITY DEFINER RPCs power the data. Charts via recharts (lazy-loaded). Future: add retention cohorts, revenue per user trends, and model usage breakdown.

### Notifications Page (2026-02-25)

Dedicated `/notifications` page with infinite scroll pagination, type filtering (All/Follows/Kudos/Comments/Mentions), and mark-all-as-read. API extended with `?limit`, `?offset`, and `?type` query params. "See all notifications" link added to the header dropdown.

### Achievements & Badges (2026-02-22, expanded 2026-02-24)

33 milestone badges earned progressively, displayed on profiles. Original 17 usage badges (First Sync through Verified Contributor) plus 16 social badges: Kudos Received/Sent and Comments Received/Sent at 4 tiers each (1/25/100/500). Stats aggregation via two Supabase RPCs (`get_achievement_stats` for usage, `get_social_achievement_stats` for social). Trigger-based filtering ensures each API route only checks relevant achievements. Featured Challenge ("The Three Comma Club") in the right sidebar.

### Shareable Recap Cards (2026-02-20, redesigned 2026-02-22)

Generate branded usage summary images (weekly/monthly) for sharing on social media. Includes OG image generation for link previews (1200x630), downloadable square PNG (1080x1080) for Instagram, and a live card preview page at `/recap`. Stats include total spend, output tokens, active days, session count, streak, primary model, and a mini contribution strip. Public users get shareable URLs at `/recap/[username]`; private users can still view and download their own card.

Redesign: light theme with 10 FLUX-generated abstract backgrounds (selectable). Contribution strip caps at today (no future-day placeholders). Background choice persists in shareable URLs via `?bg=` param.
