-- The leaderboard is public — viewable to logged-out website visitors. The
-- `onboarding_completed` column is not in the column-level grant on
-- `public.users` for anon/authenticated (see 20260413034500), so the
-- `security_invoker` views error with `permission denied for table users`
-- and the page silently renders "No entries yet." Drop the predicate; the
-- public-visibility filter (`is_public = true`) is sufficient.

CREATE OR REPLACE VIEW public.leaderboard_all_time
WITH (security_invoker = on) AS
SELECT
  u.id AS user_id,
  u.username,
  u.display_name,
  u.avatar_url,
  u.country,
  u.region,
  COALESCE(sum(d.cost_usd), 0) AS total_cost,
  COALESCE(sum(d.output_tokens), 0) AS total_output_tokens,
  count(DISTINCT d.date) AS active_days
FROM users u
LEFT JOIN daily_usage d ON d.user_id = u.id
WHERE u.is_public = true
GROUP BY u.id
HAVING COALESCE(sum(d.cost_usd), 0) > 0
ORDER BY COALESCE(sum(d.cost_usd), 0) DESC;

CREATE OR REPLACE VIEW public.leaderboard_weekly
WITH (security_invoker = on) AS
SELECT
  u.id AS user_id,
  u.username,
  u.display_name,
  u.avatar_url,
  u.country,
  u.region,
  COALESCE(sum(d.cost_usd), 0) AS total_cost,
  COALESCE(sum(d.output_tokens), 0) AS total_output_tokens,
  count(DISTINCT d.date) AS active_days
FROM users u
LEFT JOIN daily_usage d
  ON d.user_id = u.id
 AND d.date >= (CURRENT_DATE - INTERVAL '6 days')
WHERE u.is_public = true
GROUP BY u.id
HAVING COALESCE(sum(d.cost_usd), 0) > 0
ORDER BY COALESCE(sum(d.cost_usd), 0) DESC;

CREATE OR REPLACE VIEW public.leaderboard_monthly
WITH (security_invoker = on) AS
SELECT
  u.id AS user_id,
  u.username,
  u.display_name,
  u.avatar_url,
  u.country,
  u.region,
  COALESCE(sum(d.cost_usd), 0) AS total_cost,
  COALESCE(sum(d.output_tokens), 0) AS total_output_tokens,
  count(DISTINCT d.date) AS active_days
FROM users u
LEFT JOIN daily_usage d
  ON d.user_id = u.id
 AND d.date >= (CURRENT_DATE - INTERVAL '29 days')
WHERE u.is_public = true
GROUP BY u.id
HAVING COALESCE(sum(d.cost_usd), 0) > 0
ORDER BY COALESCE(sum(d.cost_usd), 0) DESC;

CREATE OR REPLACE VIEW public.leaderboard_daily
WITH (security_invoker = on) AS
WITH latest_usage AS (
  SELECT user_id, MAX(date) AS max_date
  FROM daily_usage
  WHERE date >= CURRENT_DATE - INTERVAL '1 day'
  GROUP BY user_id
),
daily_agg AS (
  SELECT
    d.user_id,
    COALESCE(SUM(d.cost_usd), 0)      AS total_cost,
    COALESCE(SUM(d.output_tokens), 0) AS total_output_tokens,
    COUNT(d.id)                        AS session_count
  FROM daily_usage d
  JOIN latest_usage lu ON d.user_id = lu.user_id AND d.date = lu.max_date
  GROUP BY d.user_id
)
SELECT
  u.id AS user_id,
  u.username,
  u.display_name,
  u.avatar_url,
  u.country,
  u.region,
  da.total_cost,
  da.total_output_tokens,
  da.session_count
FROM users u
JOIN daily_agg da ON da.user_id = u.id
WHERE u.is_public = true
ORDER BY da.total_cost DESC;
