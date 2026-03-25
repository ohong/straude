# User Levels (L1–L8)

Levels are a compact identity marker shown on profiles and leaderboard rows. They answer "how hard has this person been going?" in a single label.

## Origin

The L1–L8 system is based on a viral meme about the "8 levels of agentic engineering" that circulated on X. It describes a progression of trust and autonomy in how developers use AI coding agents:

| Level | Name | Description |
|-------|------|-------------|
| L1 | No AI | Traditional dev workflow, no AI tooling. Maybe code completions, sometimes ask Chat questions. |
| L2 | Agent in IDE, permissions on | A narrow coding agent in a sidebar asks your permission to run tools. You approve every file change, full manual control. |
| L3 | YOLO mode | Trust goes up. You turn off permissions, agent runs freely in IDE. |
| L4 | Diffs fade, conversation leads | Your agent gradually grows to fill the screen. You stop reviewing every diff, you watch what the agent is doing and focus on guiding it. Code is just for diffs. |
| L5 | Agent-first, IDE later | CLI, single agent, YOLO. You work in the agent conversation, the IDE is just where you look at the code afterward. Diffs scroll by. |
| L6 | Agent multiplexing | CLI, multi-agent, YOLO. You regularly use 3–5 parallel instances. You're bouncing between streams and you can't stop. |
| L7 | 10+ agents, managed by hand | You are pushing the limits of hand-management. Wrong context sent to the wrong agent. You start asking: "What if Claude Code could run Claude Code?" |
| L8 | Build your own orchestrator | You write the coordination layer yourself, spawning, routing, and managing agents programmatically. You are on the frontier, automating your workflow. |

The Y-axis of the meme is **AI autonomy + trust** — from full human control at L1 to programmatic orchestration at L8. The progression moves through three eras: IDE Era (L1–L4), Agent-First (L5–L6), and Orchestration (L7–L8).

Straude's level system maps these stages to measurable usage signals (active days + spend), so your level reflects how deeply you've integrated agentic coding into your daily workflow.

## How it works

A user's level is determined by their **rolling 30-day window** — the last 30 calendar days from today (timezone-aware). Two gates must both be met in that same window:

1. **Active days** — distinct dates with at least one `daily_usage` row
2. **Spend** — cumulative `cost_usd` across those rows

| Level | Active Days (≥) | Spend (≥) |
|-------|-----------------|-----------|
| L1    | 1               | $1        |
| L2    | 3               | $10       |
| L3    | 7               | $40       |
| L4    | 10              | $100      |
| L5    | 15              | $250      |
| L6    | 20              | $500      |
| L7    | 24              | $1,000    |
| L8    | 28              | $2,000    |

Both conditions must be satisfied. A single expensive day cannot unlock a high level — consistency is required at every tier.

## Calculation

The function `recalculate_user_level(p_user_id)` in Postgres:

1. Resolves the user's timezone (falls back to UTC)
2. Computes `today` in that timezone
3. Defines `window_start = today - 29` (30 days inclusive)
4. Sums `cost_usd` and counts distinct active dates in `daily_usage` for that window
5. Matches against the threshold table top-down (L8 first) and takes the highest qualifying level
6. Upserts into `user_levels`; if level changed, updates `promoted_at`
7. If no threshold met, deletes the `user_levels` row (no badge shown)

Recalculation is triggered on each usage submission (`/api/usage/submit`), not on reads.

## Key design decisions

- **Rolling, not sticky** — the current implementation uses a rolling 30-day window. If a user stops logging, their level drops to 0 and the badge disappears. (The original plan spec proposed sticky/never-downgrade levels based on the best historical window, but the shipped implementation was later changed to rolling.)
- **Two gates, not one** — prevents "whale in a day" scenarios. You can't buy your way to L8 without 28 active days.
- **Display only** — levels don't gate features, sort the leaderboard, or replace achievements/rank/streak.
- **No named titles** — just `L1`–`L8`, no "Architect" or "Orchestrator" labels.

## Where levels appear

| Surface | Format | Details |
|---------|--------|---------|
| Leaderboard table | `L4` badge | Accent-colored, monospace, next to username |
| CLI `straude status` / push summary | `Lv 4` | Muted text in header line |
| Profile page | `L4` badge | Near username in stats area |

Users with no qualifying level show no badge.

## Schema

Table: `user_levels`

| Column | Type | Description |
|--------|------|-------------|
| `user_id` | `uuid` (PK) | References `users(id)` |
| `level` | `integer` | 1–8 |
| `best_window_start` | `date` | Start of the qualifying window |
| `best_window_end` | `date` | End of the qualifying window (today) |
| `best_window_cost_usd` | `numeric` | Total spend in window |
| `best_window_active_days` | `integer` | Active day count in window |
| `promoted_at` | `timestamptz` | When level last changed |
| `updated_at` | `timestamptz` | Last recalculation time |

## Source files

| File | Role |
|------|------|
| `supabase/migrations/20260316133500_add_user_levels.sql` | Initial schema, table, and RLS |
| `supabase/migrations/20260316233000_make_user_levels_rolling.sql` | Rolling 30-day window function (current) |
| `apps/web/app/api/leaderboard/route.ts` | Batch-fetches levels for leaderboard entries |
| `apps/web/app/api/cli/dashboard/route.ts` | Fetches single user level for CLI |
| `apps/web/components/app/leaderboard/LeaderboardTable.tsx` | Renders level badge on leaderboard rows |
| `packages/cli/src/components/PushSummary.tsx` | Renders `Lv N` in CLI output |
| `apps/web/types/index.ts` | `UserLevel` and `LeaderboardEntry` types |
| `.waypoint/docs/usage-levels-plan.md` | Original product spec and rationale |
