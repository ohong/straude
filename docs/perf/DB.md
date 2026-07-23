# Database performance evidence

Recorded 2026-07-18 against Supabase project `kanfzeovbmusnhmbnhit`. The M4
snapshot migration and its follow-up foreign-key index are live.

## Live baseline

- `public.daily_usage`: approximately 6,913 rows and 6.2 MB.
- Existing indexes: primary key, unique `(user_id, date)`, `date DESC`, and
  `(user_id, date DESC)`.
- `pg_cron`: version 1.6.4. The only current job is
  `expire-cli-auth-codes`.
- Supabase advisors before M4: 35 security notices and 45 performance notices.
  Deployment acceptance is no new notices, not a globally clean advisor run.
- Weekly leaderboard baseline: 2.577 ms execution, 288 shared-hit blocks, using
  a bitmap heap scan through `idx_daily_usage_date`.

## Live post-apply result

- Snapshot leaderboard query: 0.057 ms execution and 5 shared-hit blocks.
- Snapshot rows: 355 in `public.leaderboard_snapshots` and 561 in
  `public.profile_stats_snapshots`.
- Supabase advisors returned to the exact baseline after both migrations: 35
  security notices and 45 performance notices, with no migration-related
  notices.
- `idx_leaderboard_snapshots_user_id` covers foreign-key maintenance. A live
  lookup used it in a bitmap index scan and completed in 0.193 ms.
- A live period-and-region query used
  `idx_leaderboard_snapshots_period_region_cost` and completed in 0.116 ms.

## EXPLAIN query

Run this before and after applying the migration, with `BUFFERS` enabled, to
measure whether the covering index reduces heap access for the date-window
aggregation:

```sql
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT
  u.id AS user_id,
  COALESCE(SUM(d.cost_usd), 0) AS total_cost,
  COALESCE(SUM(d.output_tokens), 0) AS total_output_tokens,
  COUNT(DISTINCT d.date) AS active_days
FROM public.users AS u
LEFT JOIN public.daily_usage AS d
  ON d.user_id = u.id
 AND d.date >= CURRENT_DATE - INTERVAL '6 days'
WHERE u.is_public = true
GROUP BY u.id
HAVING COALESCE(SUM(d.cost_usd), 0) > 0
ORDER BY total_cost DESC;
```

The M4 migration adds
`(date DESC, user_id) INCLUDE (cost_usd, output_tokens)`, but the planner may
reasonably retain the existing plan at this data size. The measured
request-path win comes from moving leaderboard aggregation and radar
distributions to the ten-minute snapshot refresh.
