-- SECURITY DEFINER functions execute with their owner privileges. PostgreSQL
-- grants EXECUTE to PUBLIC by default, so every privileged RPC must either
-- authorize its caller internally or revoke PUBLIC explicitly.

CREATE OR REPLACE FUNCTION public.increment_streak_freezes(
  p_user_id uuid,
  p_max integer DEFAULT 7
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Forbidden'
      USING ERRCODE = '42501';
  END IF;

  IF p_max IS NULL OR p_max < 1 OR p_max > 7 THEN
    RAISE EXCEPTION 'p_max must be between 1 and 7'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.users
  SET streak_freezes = LEAST(streak_freezes + 1, p_max)
  WHERE id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_streak_freezes(uuid, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_streak_freezes(uuid, integer)
  TO service_role;

-- A historical one-argument overload bypasses the authorization below and
-- also makes PostgREST resolution ambiguous with the defaulted second
-- argument. All callers remain compatible with this two-argument function.
DROP FUNCTION IF EXISTS public.calculate_user_streak(uuid);

CREATE OR REPLACE FUNCTION public.calculate_user_streak(
  p_user_id uuid,
  p_freeze_days integer DEFAULT 0
)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  streak_count integer := 0;
  current_date_check date;
  has_usage boolean;
  latest_date date;
  user_tz text;
  user_today date;
  grace integer;
  v_auth_user_id uuid := auth.uid();
  v_can_view boolean := false;
  v_freeze_days integer;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = p_user_id
      AND (
        auth.role() = 'service_role'
        OR u.is_public = true
        OR u.id = v_auth_user_id
        OR (
          v_auth_user_id IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM public.follows f
            WHERE f.follower_id = v_auth_user_id
              AND f.following_id = u.id
          )
        )
      )
  ) INTO v_can_view;

  IF NOT v_can_view THEN
    RAISE EXCEPTION 'Forbidden'
      USING ERRCODE = '42501';
  END IF;

  SELECT
    COALESCE(NULLIF(timezone, ''), 'UTC'),
    LEAST(GREATEST(COALESCE(streak_freezes, 0), 0), 7)
  INTO user_tz, v_freeze_days
  FROM public.users
  WHERE id = p_user_id;

  IF user_tz IS NULL THEN
    user_tz := 'UTC';
  END IF;

  BEGIN
    user_today := (now() AT TIME ZONE user_tz)::date;
  EXCEPTION WHEN OTHERS THEN
    user_today := (now() AT TIME ZONE 'UTC')::date;
  END;

  grace := 1 + v_freeze_days;

  SELECT max(date) INTO latest_date
  FROM public.daily_usage
  WHERE user_id = p_user_id;

  IF latest_date IS NULL OR latest_date < user_today - grace THEN
    RETURN 0;
  END IF;

  current_date_check := latest_date;
  LOOP
    SELECT EXISTS (
      SELECT 1
      FROM public.daily_usage
      WHERE user_id = p_user_id
        AND date = current_date_check
    ) INTO has_usage;

    EXIT WHEN NOT has_usage;
    streak_count := streak_count + 1;
    current_date_check := current_date_check - 1;
  END LOOP;

  RETURN streak_count;
END;
$$;

REVOKE ALL ON FUNCTION public.calculate_user_streak(uuid, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_user_streak(uuid, integer)
  TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.calculate_streaks_batch(p_user_ids uuid[])
RETURNS TABLE(user_id uuid, streak integer)
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  IF p_user_ids IS NULL THEN
    RETURN;
  END IF;

  IF cardinality(p_user_ids) > 100 THEN
    RAISE EXCEPTION 'A maximum of 100 user IDs is allowed'
      USING ERRCODE = '22023';
  END IF;

  FOREACH v_user_id IN ARRAY p_user_ids LOOP
    user_id := v_user_id;
    BEGIN
      streak := public.calculate_user_streak(v_user_id, 0);
    EXCEPTION
      WHEN SQLSTATE '42501' THEN
        streak := 0;
    END;
    RETURN NEXT;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.calculate_streaks_batch(uuid[])
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_streaks_batch(uuid[])
  TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_feed(
  p_type text,
  p_user_id uuid DEFAULT NULL,
  p_limit int DEFAULT 20,
  p_cursor_date date DEFAULT NULL,
  p_cursor_created_at timestamptz DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  daily_usage_id uuid,
  title text,
  description text,
  images jsonb,
  created_at timestamptz,
  updated_at timestamptz,
  "user" jsonb,
  daily_usage jsonb,
  kudos_count bigint,
  comment_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_auth_user_id uuid := auth.uid();
  v_can_view_user boolean := false;
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 20), 1), 100);
BEGIN
  IF p_type IN ('mine', 'following') THEN
    IF v_auth_user_id IS NULL OR p_user_id IS NULL OR p_user_id <> v_auth_user_id THEN
      RAISE EXCEPTION 'Unauthorized'
        USING ERRCODE = '42501';
    END IF;
  ELSIF p_type = 'user' THEN
    IF p_user_id IS NULL THEN
      RAISE EXCEPTION 'user_id is required for user feed type'
        USING ERRCODE = '22023';
    END IF;

    SELECT EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = p_user_id
        AND (
          u.is_public = true
          OR u.id = v_auth_user_id
          OR (
            v_auth_user_id IS NOT NULL
            AND EXISTS (
              SELECT 1
              FROM public.follows f
              WHERE f.follower_id = v_auth_user_id
                AND f.following_id = u.id
            )
          )
        )
    ) INTO v_can_view_user;

    IF NOT v_can_view_user THEN
      RAISE EXCEPTION 'Forbidden'
        USING ERRCODE = '42501';
    END IF;
  ELSIF p_type <> 'global' THEN
    RAISE EXCEPTION 'Invalid feed type: %', p_type
      USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.user_id,
    p.daily_usage_id,
    p.title,
    p.description,
    p.images,
    p.created_at,
    p.updated_at,
    jsonb_build_object(
      'id', u.id,
      'username', u.username,
      'display_name', u.display_name,
      'bio', u.bio,
      'avatar_url', u.avatar_url,
      'country', u.country,
      'region', u.region,
      'link', u.link,
      'github_username', u.github_username,
      'team_url', u.team_url,
      'team_favicon_url', u.team_favicon_url,
      'is_public', u.is_public
    ) AS "user",
    jsonb_build_object(
      'id', d.id,
      'user_id', d.user_id,
      'date', d.date,
      'cost_usd', d.cost_usd,
      'input_tokens', d.input_tokens,
      'output_tokens', d.output_tokens,
      'reasoning_output_tokens', d.reasoning_output_tokens,
      'cache_creation_tokens', d.cache_creation_tokens,
      'cache_read_tokens', d.cache_read_tokens,
      'total_tokens', d.total_tokens,
      'models', d.models,
      'model_breakdown', d.model_breakdown,
      'session_count', d.session_count,
      'is_verified', d.is_verified,
      'created_at', d.created_at,
      'updated_at', d.updated_at
    ) AS daily_usage,
    (SELECT count(*) FROM public.kudos k WHERE k.post_id = p.id) AS kudos_count,
    (SELECT count(*) FROM public.comments c WHERE c.post_id = p.id) AS comment_count
  FROM public.posts p
  JOIN public.users u ON u.id = p.user_id
  JOIN public.daily_usage d
    ON d.id = p.daily_usage_id
   AND d.user_id = p.user_id
  WHERE
    CASE p_type
      WHEN 'global' THEN u.is_public = true
      WHEN 'mine' THEN p.user_id = p_user_id
      WHEN 'user' THEN p.user_id = p_user_id
      WHEN 'following' THEN
        p.user_id = p_user_id
        OR EXISTS (
          SELECT 1
          FROM public.follows f
          WHERE f.follower_id = p_user_id
            AND f.following_id = p.user_id
        )
      ELSE false
    END
    AND CASE
      WHEN p_cursor_date IS NULL AND p_cursor_created_at IS NULL THEN true
      WHEN p_cursor_date IS NOT NULL THEN
        d.date < p_cursor_date
        OR (d.date = p_cursor_date AND p.created_at < p_cursor_created_at)
      ELSE p.created_at < p_cursor_created_at
    END
  ORDER BY d.date DESC, p.created_at DESC
  LIMIT v_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.get_feed(text, uuid, int, date, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_feed(text, uuid, int, date, timestamptz)
  TO anon, authenticated, service_role;

-- The application no longer calls the legacy following-feed RPC. Its latest
-- definition returns to_jsonb(users.*), so leave it available only to trusted
-- server code until it can be removed.
REVOKE ALL ON FUNCTION public.get_following_feed(uuid, int, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_following_feed(uuid, int, timestamptz)
  TO service_role;

REVOKE ALL ON FUNCTION public.get_direct_message_threads(int)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_direct_message_threads(int)
  TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.admin_cumulative_spend()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_top_users(int)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_activation_funnel()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_growth_metrics()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_cohort_retention()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_revenue_concentration()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_time_to_first_sync()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_model_usage_by_day()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_model_share_by_day()
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.admin_cumulative_spend() TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_top_users(int) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_activation_funnel() TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_growth_metrics() TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_cohort_retention() TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_revenue_concentration() TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_time_to_first_sync() TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_model_usage_by_day() TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_model_share_by_day() TO service_role;
