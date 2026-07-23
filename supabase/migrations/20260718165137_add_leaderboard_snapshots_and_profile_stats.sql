-- M4 database primitives. This migration is intentionally safe to stage before
-- the application switches every reader: the existing leaderboard views remain
-- in place as fallbacks.

CREATE INDEX IF NOT EXISTS idx_daily_usage_leaderboard_covering
  ON public.daily_usage (date DESC, user_id)
  INCLUDE (cost_usd, output_tokens);

CREATE TABLE IF NOT EXISTS public.leaderboard_snapshots (
  period TEXT NOT NULL CHECK (period IN ('day', 'week', 'month', 'all_time')),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  username TEXT,
  display_name TEXT,
  avatar_url TEXT,
  country TEXT,
  region TEXT,
  total_cost NUMERIC NOT NULL DEFAULT 0,
  total_output_tokens BIGINT NOT NULL DEFAULT 0,
  active_days BIGINT,
  session_count BIGINT,
  refreshed_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (period, user_id)
);

CREATE INDEX IF NOT EXISTS idx_leaderboard_snapshots_period_cost
  ON public.leaderboard_snapshots (period, total_cost DESC, user_id);

CREATE INDEX IF NOT EXISTS idx_leaderboard_snapshots_period_region_cost
  ON public.leaderboard_snapshots (period, region, total_cost DESC, user_id);

ALTER TABLE public.leaderboard_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role reads leaderboard snapshots"
  ON public.leaderboard_snapshots
  FOR SELECT
  TO service_role
  USING (true);
REVOKE ALL ON TABLE public.leaderboard_snapshots FROM PUBLIC;
REVOKE ALL ON TABLE public.leaderboard_snapshots FROM anon;
REVOKE ALL ON TABLE public.leaderboard_snapshots FROM authenticated;
GRANT SELECT ON TABLE public.leaderboard_snapshots TO service_role;

CREATE TABLE IF NOT EXISTS public.profile_stats_snapshots (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  output INTEGER NOT NULL CHECK (output BETWEEN 0 AND 100),
  intensity INTEGER NOT NULL CHECK (intensity BETWEEN 0 AND 100),
  consistency INTEGER NOT NULL CHECK (consistency BETWEEN 0 AND 100),
  toolkit INTEGER NOT NULL CHECK (toolkit BETWEEN 0 AND 100),
  community INTEGER NOT NULL CHECK (community BETWEEN 0 AND 100),
  refreshed_at TIMESTAMPTZ NOT NULL
);

ALTER TABLE public.profile_stats_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role reads profile stats snapshots"
  ON public.profile_stats_snapshots
  FOR SELECT
  TO service_role
  USING (true);
REVOKE ALL ON TABLE public.profile_stats_snapshots FROM PUBLIC;
REVOKE ALL ON TABLE public.profile_stats_snapshots FROM anon;
REVOKE ALL ON TABLE public.profile_stats_snapshots FROM authenticated;
GRANT SELECT ON TABLE public.profile_stats_snapshots TO service_role;

CREATE OR REPLACE FUNCTION public.refresh_leaderboard_snapshots()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_refreshed_at TIMESTAMPTZ := clock_timestamp();
BEGIN
  IF NOT pg_catalog.pg_try_advisory_xact_lock(
    pg_catalog.hashtextextended('public.refresh_leaderboard_snapshots', 0)
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.leaderboard_snapshots (
    period,
    user_id,
    username,
    display_name,
    avatar_url,
    country,
    region,
    total_cost,
    total_output_tokens,
    active_days,
    session_count,
    refreshed_at
  )
  SELECT
    source.period,
    source.user_id,
    source.username,
    source.display_name,
    source.avatar_url,
    source.country,
    source.region,
    source.total_cost,
    source.total_output_tokens,
    source.active_days,
    source.session_count,
    v_refreshed_at
  FROM (
    SELECT
      'day'::TEXT AS period,
      user_id,
      username,
      display_name,
      avatar_url,
      country,
      region,
      total_cost,
      total_output_tokens,
      NULL::BIGINT AS active_days,
      session_count::BIGINT AS session_count
    FROM public.leaderboard_daily
    UNION ALL
    SELECT
      'week'::TEXT,
      user_id,
      username,
      display_name,
      avatar_url,
      country,
      region,
      total_cost,
      total_output_tokens,
      active_days::BIGINT,
      NULL::BIGINT
    FROM public.leaderboard_weekly
    UNION ALL
    SELECT
      'month'::TEXT,
      user_id,
      username,
      display_name,
      avatar_url,
      country,
      region,
      total_cost,
      total_output_tokens,
      active_days::BIGINT,
      NULL::BIGINT
    FROM public.leaderboard_monthly
    UNION ALL
    SELECT
      'all_time'::TEXT,
      user_id,
      username,
      display_name,
      avatar_url,
      country,
      region,
      total_cost,
      total_output_tokens,
      active_days::BIGINT,
      NULL::BIGINT
    FROM public.leaderboard_all_time
  ) AS source
  ON CONFLICT (period, user_id) DO UPDATE SET
    username = EXCLUDED.username,
    display_name = EXCLUDED.display_name,
    avatar_url = EXCLUDED.avatar_url,
    country = EXCLUDED.country,
    region = EXCLUDED.region,
    total_cost = EXCLUDED.total_cost,
    total_output_tokens = EXCLUDED.total_output_tokens,
    active_days = EXCLUDED.active_days,
    session_count = EXCLUDED.session_count,
    refreshed_at = EXCLUDED.refreshed_at;

  -- The function executes in one transaction, so readers see either the old
  -- complete snapshot or the new complete snapshot, never the upsert/delete
  -- transition between them.
  DELETE FROM public.leaderboard_snapshots
  WHERE refreshed_at <> v_refreshed_at;

  WITH usage_stats AS (
    SELECT
      d.user_id,
      COALESCE(SUM(d.output_tokens), 0)::NUMERIC AS total_output,
      COALESCE(SUM(d.cost_usd), 0)::NUMERIC AS total_cost,
      COUNT(*)::INTEGER AS row_count
    FROM public.daily_usage AS d
    GROUP BY d.user_id
  ),
  toolkit_stats AS (
    SELECT
      d.user_id,
      COUNT(DISTINCT breakdown.entry->>'model')::INTEGER AS model_count
    FROM public.daily_usage AS d
    CROSS JOIN LATERAL pg_catalog.jsonb_array_elements(
      CASE
        WHEN pg_catalog.jsonb_typeof(d.model_breakdown) = 'array'
          THEN d.model_breakdown
        ELSE '[]'::JSONB
      END
    ) AS breakdown(entry)
    WHERE NULLIF(breakdown.entry->>'model', '') IS NOT NULL
    GROUP BY d.user_id
  ),
  follower_stats AS (
    SELECT following_id AS user_id, COUNT(*)::INTEGER AS follower_count
    FROM public.follows
    GROUP BY following_id
  ),
  kudos_stats AS (
    SELECT p.user_id, COUNT(*)::INTEGER AS kudos_count
    FROM public.kudos AS k
    JOIN public.posts AS p ON p.id = k.post_id
    GROUP BY p.user_id
  ),
  crew_stats AS (
    SELECT referred_by AS user_id, COUNT(*)::INTEGER AS crew_count
    FROM public.users
    WHERE referred_by IS NOT NULL
    GROUP BY referred_by
  ),
  profile_values AS (
    SELECT
      u.id AS user_id,
      usage.user_id IS NOT NULL AS has_usage,
      COALESCE(usage.total_output, 0) AS output_value,
      CASE
        WHEN COALESCE(usage.row_count, 0) > 0
          THEN usage.total_cost / usage.row_count
        ELSE 0
      END AS intensity_value,
      CASE
        WHEN COALESCE(usage.row_count, 0) > 0
          THEN LEAST(
            100::NUMERIC,
            usage.row_count::NUMERIC
              / GREATEST(1, CURRENT_DATE - u.created_at::DATE)
              * 100
          )
        ELSE 0
      END AS consistency_value,
      COALESCE(toolkit.model_count, 0)::NUMERIC AS toolkit_value,
      (
        COALESCE(followers.follower_count, 0)
        + COALESCE(kudos.kudos_count, 0)
        + COALESCE(crew.crew_count, 0)
      )::NUMERIC AS community_value
    FROM public.users AS u
    LEFT JOIN usage_stats AS usage ON usage.user_id = u.id
    LEFT JOIN toolkit_stats AS toolkit ON toolkit.user_id = u.id
    LEFT JOIN follower_stats AS followers ON followers.user_id = u.id
    LEFT JOIN kudos_stats AS kudos ON kudos.user_id = u.id
    LEFT JOIN crew_stats AS crew ON crew.user_id = u.id
  ),
  distribution_size AS (
    SELECT COUNT(*)::NUMERIC AS usage_users
    FROM profile_values
    WHERE has_usage
  ),
  usage_ranks AS (
    SELECT
      user_id,
      RANK() OVER (ORDER BY output_value) - 1 AS output_lower,
      RANK() OVER (ORDER BY intensity_value) - 1 AS intensity_lower,
      RANK() OVER (ORDER BY consistency_value) - 1 AS consistency_lower,
      RANK() OVER (ORDER BY toolkit_value) - 1 AS toolkit_lower,
      RANK() OVER (ORDER BY community_value) - 1 AS community_lower
    FROM profile_values
    WHERE has_usage
  ),
  community_distribution AS (
    SELECT
      community_value,
      COUNT(*)::NUMERIC AS bucket_size,
      COALESCE(
        SUM(COUNT(*)) OVER (
          ORDER BY community_value
          ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
        ),
        0
      )::NUMERIC AS lower_count
    FROM profile_values
    WHERE has_usage
    GROUP BY community_value
  ),
  profile_percentiles AS (
    SELECT
      target.user_id,
      ROUND(
        100.0 * CASE WHEN target.has_usage THEN ranks.output_lower ELSE 0 END
        / NULLIF(size.usage_users + CASE WHEN target.has_usage THEN 0 ELSE 1 END, 0)
      )::INTEGER AS output,
      ROUND(
        100.0 * CASE WHEN target.has_usage THEN ranks.intensity_lower ELSE 0 END
        / NULLIF(size.usage_users + CASE WHEN target.has_usage THEN 0 ELSE 1 END, 0)
      )::INTEGER AS intensity,
      ROUND(
        100.0 * CASE WHEN target.has_usage THEN ranks.consistency_lower ELSE 0 END
        / NULLIF(size.usage_users + CASE WHEN target.has_usage THEN 0 ELSE 1 END, 0)
      )::INTEGER AS consistency,
      ROUND(
        100.0 * CASE WHEN target.has_usage THEN ranks.toolkit_lower ELSE 0 END
        / NULLIF(size.usage_users + CASE WHEN target.has_usage THEN 0 ELSE 1 END, 0)
      )::INTEGER AS toolkit,
      ROUND(
        100.0 * CASE
          WHEN target.has_usage THEN ranks.community_lower
          ELSE COALESCE(community_rank.lower_count + community_rank.bucket_size, 0)
        END
        / NULLIF(size.usage_users + CASE WHEN target.has_usage THEN 0 ELSE 1 END, 0)
      )::INTEGER AS community
    FROM profile_values AS target
    CROSS JOIN distribution_size AS size
    LEFT JOIN usage_ranks AS ranks ON ranks.user_id = target.user_id
    LEFT JOIN LATERAL (
      SELECT lower_count, bucket_size
      FROM community_distribution
      WHERE community_value < target.community_value
      ORDER BY community_value DESC
      LIMIT 1
    ) AS community_rank ON NOT target.has_usage
  )
  INSERT INTO public.profile_stats_snapshots (
    user_id,
    output,
    intensity,
    consistency,
    toolkit,
    community,
    refreshed_at
  )
  SELECT
    user_id,
    output,
    intensity,
    consistency,
    toolkit,
    community,
    v_refreshed_at
  FROM profile_percentiles
  ON CONFLICT (user_id) DO UPDATE SET
    output = EXCLUDED.output,
    intensity = EXCLUDED.intensity,
    consistency = EXCLUDED.consistency,
    toolkit = EXCLUDED.toolkit,
    community = EXCLUDED.community,
    refreshed_at = EXCLUDED.refreshed_at;

  DELETE FROM public.profile_stats_snapshots
  WHERE refreshed_at <> v_refreshed_at;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_leaderboard_snapshots() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.refresh_leaderboard_snapshots() FROM anon;
REVOKE ALL ON FUNCTION public.refresh_leaderboard_snapshots() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_leaderboard_snapshots() TO service_role;

-- Preserve timezone and freeze-day semantics while replacing the per-day loop
-- with one indexed, set-based scan of the user's distinct usage dates.
CREATE OR REPLACE FUNCTION public.calculate_user_streak(
  p_user_id UUID,
  p_freeze_days INTEGER DEFAULT 0
)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_latest_date DATE;
  v_user_timezone TEXT;
  v_user_today DATE;
  v_grace INTEGER;
  v_streak INTEGER;
BEGIN
  SELECT COALESCE(NULLIF(timezone, ''), 'UTC')
  INTO v_user_timezone
  FROM public.users
  WHERE id = p_user_id;

  IF v_user_timezone IS NULL THEN
    v_user_timezone := 'UTC';
  END IF;

  BEGIN
    v_user_today := (pg_catalog.now() AT TIME ZONE v_user_timezone)::DATE;
  EXCEPTION WHEN OTHERS THEN
    v_user_today := (pg_catalog.now() AT TIME ZONE 'UTC')::DATE;
  END;

  v_grace := 1 + p_freeze_days;

  SELECT MAX(date)
  INTO v_latest_date
  FROM public.daily_usage
  WHERE user_id = p_user_id;

  IF v_latest_date IS NULL OR v_latest_date < v_user_today - v_grace THEN
    RETURN 0;
  END IF;

  WITH ordered_dates AS (
    SELECT
      date,
      ROW_NUMBER() OVER (ORDER BY date DESC) - 1 AS date_offset
    FROM (
      SELECT DISTINCT date
      FROM public.daily_usage
      WHERE user_id = p_user_id
        AND date <= v_latest_date
    ) AS dates
  )
  SELECT COUNT(*)::INTEGER
  INTO v_streak
  FROM ordered_dates
  WHERE date = v_latest_date - date_offset::INTEGER;

  RETURN COALESCE(v_streak, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.calculate_user_streak(UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.calculate_user_streak(UUID, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION public.calculate_user_streak(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_user_streak(UUID, INTEGER) TO service_role;

-- Service-only one-row snapshot read. All global aggregation is performed by
-- refresh_leaderboard_snapshots(), never in the request path.
CREATE OR REPLACE FUNCTION public.get_profile_stats(p_user_id UUID)
RETURNS TABLE (
  output INTEGER,
  intensity INTEGER,
  consistency INTEGER,
  toolkit INTEGER,
  community INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    stats.output,
    stats.intensity,
    stats.consistency,
    stats.toolkit,
    stats.community
  FROM public.profile_stats_snapshots AS stats
  WHERE stats.user_id = p_user_id;
$$;

REVOKE ALL ON FUNCTION public.get_profile_stats(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_profile_stats(UUID) FROM anon;
REVOKE ALL ON FUNCTION public.get_profile_stats(UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_profile_stats(UUID) TO service_role;

DROP FUNCTION IF EXISTS public.refresh_leaderboards();
DROP INDEX IF EXISTS public.leaderboard_daily_user_id;
DROP INDEX IF EXISTS public.leaderboard_weekly_user_id;
DROP INDEX IF EXISTS public.leaderboard_monthly_user_id;
DROP INDEX IF EXISTS public.leaderboard_all_time_user_id;
DROP INDEX IF EXISTS public.idx_leaderboard_daily_user;
DROP INDEX IF EXISTS public.idx_leaderboard_weekly_user;
DROP INDEX IF EXISTS public.idx_leaderboard_monthly_user;
DROP INDEX IF EXISTS public.idx_leaderboard_all_time_user;

DO $$
DECLARE
  v_job RECORD;
BEGIN
  FOR v_job IN
    SELECT jobid
    FROM cron.job
    WHERE jobname IN (
      'refresh-leaderboard-daily',
      'refresh-leaderboard-weekly',
      'refresh-leaderboard-monthly',
      'refresh-leaderboard-all-time',
      'refresh-leaderboard-snapshots'
    )
  LOOP
    PERFORM cron.unschedule(v_job.jobid);
  END LOOP;
END;
$$;

SELECT public.refresh_leaderboard_snapshots();

SELECT cron.schedule(
  'refresh-leaderboard-snapshots',
  '*/10 * * * *',
  'SELECT public.refresh_leaderboard_snapshots()'
);
