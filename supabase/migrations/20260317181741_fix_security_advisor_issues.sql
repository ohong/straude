
-- =============================================================
-- 1. Fix leaderboard_daily: SECURITY DEFINER → SECURITY INVOKER
-- =============================================================
DROP VIEW IF EXISTS public.leaderboard_daily;

CREATE VIEW public.leaderboard_daily
WITH (security_invoker = true)
AS
WITH latest_usage AS (
  SELECT daily_usage.user_id,
    max(daily_usage.date) AS max_date
  FROM public.daily_usage
  WHERE daily_usage.date >= (CURRENT_DATE - '1 day'::interval)
  GROUP BY daily_usage.user_id
), daily_agg AS (
  SELECT d.user_id,
    COALESCE(sum(d.cost_usd), 0::numeric) AS total_cost,
    COALESCE(sum(d.output_tokens), 0::numeric) AS total_output_tokens,
    count(d.id) AS session_count
  FROM public.daily_usage d
    JOIN latest_usage lu ON d.user_id = lu.user_id AND d.date = lu.max_date
  GROUP BY d.user_id
)
SELECT u.id AS user_id,
  u.username,
  u.display_name,
  u.avatar_url,
  u.country,
  u.region,
  da.total_cost,
  da.total_output_tokens,
  da.session_count
FROM public.users u
  JOIN daily_agg da ON da.user_id = u.id
WHERE u.is_public = true AND u.onboarding_completed = true
ORDER BY da.total_cost DESC;

-- Restore grants
GRANT SELECT ON public.leaderboard_daily TO anon;
GRANT SELECT ON public.leaderboard_daily TO authenticated;
GRANT ALL ON public.leaderboard_daily TO service_role;

-- =============================================================
-- 2. Fix functions: pin search_path
-- =============================================================

-- 2a. search_companies_fuzzy
CREATE OR REPLACE FUNCTION public.search_companies_fuzzy(search_query text, result_limit integer DEFAULT 10)
 RETURNS TABLE(id uuid, slug text, company_name text, yc_batch text, one_liner text, founders jsonb, categories text[], founded_year integer, status text, yc_url text, location text, website text, team_size integer, launched_at bigint, last_synced_at timestamp with time zone, created_at timestamp with time zone, search_vector tsvector, similarity_score real)
 LANGUAGE plpgsql
 SET search_path = 'public'
AS $function$
DECLARE
  query_lower TEXT := lower(search_query);
  old_threshold REAL;
BEGIN
  old_threshold := current_setting('pg_trgm.similarity_threshold')::REAL;
  PERFORM set_config('pg_trgm.similarity_threshold', '0.15', true);

  RETURN QUERY
  SELECT 
    c.id,
    c.slug,
    c.company_name,
    c.yc_batch,
    c.one_liner,
    c.founders,
    c.categories,
    c.founded_year,
    c.status,
    c.yc_url,
    c.location,
    c.website,
    c.team_size,
    c.launched_at,
    c.last_synced_at,
    c.created_at,
    c.search_vector,
    (
      CASE WHEN c.company_name ILIKE query_lower THEN 100.0 ELSE 0.0 END
      + CASE WHEN c.company_name ILIKE query_lower || '%' THEN 50.0 ELSE 0.0 END
      + CASE WHEN c.company_name ILIKE '%' || query_lower || '%' THEN 25.0 ELSE 0.0 END
      + CASE WHEN c.slug LIKE query_lower || '%' THEN 20.0 ELSE 0.0 END
      + CASE WHEN c.yc_batch ILIKE query_lower || '%' THEN 15.0 ELSE 0.0 END
      + similarity(c.company_name, search_query) * 15.0
      + similarity(c.slug, search_query) * 10.0
      + similarity(coalesce(c.one_liner, ''), search_query) * 5.0
    )::REAL AS similarity_score
  FROM companies c
  WHERE 
    c.company_name % search_query
    OR c.slug % search_query
    OR c.one_liner ILIKE '%' || query_lower || '%'
    OR c.yc_batch ILIKE '%' || query_lower || '%'
    OR c.company_name ILIKE '%' || query_lower || '%'
  ORDER BY 
    CASE WHEN c.status IN ('inactive', 'acquired') THEN 0 ELSE 1 END,
    similarity_score DESC, 
    c.company_name ASC
  LIMIT result_limit;

  PERFORM set_config('pg_trgm.similarity_threshold', old_threshold::TEXT, true);
END;
$function$;

-- 2b. increment_streak_freezes (keep SECURITY DEFINER, add search_path)
CREATE OR REPLACE FUNCTION public.increment_streak_freezes(p_user_id uuid, p_max integer DEFAULT 7)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
BEGIN
  UPDATE public.users
  SET streak_freezes = LEAST(streak_freezes + 1, p_max)
  WHERE id = p_user_id;
END;
$function$;

-- 2c. calculate_user_streak
CREATE OR REPLACE FUNCTION public.calculate_user_streak(p_user_id uuid, p_freeze_days integer DEFAULT 0)
 RETURNS integer
 LANGUAGE plpgsql
 STABLE
 SET search_path = 'public'
AS $function$
DECLARE
  streak_count INTEGER := 0;
  current_date_check DATE;
  has_usage BOOLEAN;
  latest_date DATE;
  user_tz TEXT;
  user_today DATE;
  grace INTEGER;
BEGIN
  SELECT COALESCE(NULLIF(timezone, ''), 'UTC') INTO user_tz
  FROM public.users
  WHERE id = p_user_id;

  IF user_tz IS NULL THEN
    user_tz := 'UTC';
  END IF;

  BEGIN
    user_today := (NOW() AT TIME ZONE user_tz)::date;
  EXCEPTION WHEN OTHERS THEN
    user_today := (NOW() AT TIME ZONE 'UTC')::date;
  END;

  grace := 1 + p_freeze_days;

  SELECT MAX(date) INTO latest_date
  FROM public.daily_usage
  WHERE user_id = p_user_id;

  IF latest_date IS NULL THEN
    RETURN 0;
  END IF;

  IF latest_date < user_today - grace THEN
    RETURN 0;
  END IF;

  current_date_check := latest_date;
  LOOP
    SELECT EXISTS(
      SELECT 1 FROM public.daily_usage
      WHERE user_id = p_user_id AND date = current_date_check
    ) INTO has_usage;

    IF has_usage THEN
      streak_count := streak_count + 1;
      current_date_check := current_date_check - 1;
    ELSE
      EXIT;
    END IF;
  END LOOP;

  RETURN streak_count;
END;
$function$;

-- 2d. calculate_streaks_batch
CREATE OR REPLACE FUNCTION public.calculate_streaks_batch(p_user_ids uuid[])
 RETURNS TABLE(user_id uuid, streak integer)
 LANGUAGE plpgsql
 SET search_path = 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT uid, public.calculate_user_streak(uid, 0)
  FROM unnest(p_user_ids) AS uid;
END;
$function$;

-- =============================================================
-- 3. Add RLS policies for tables with RLS enabled but no policies
-- =============================================================

-- email_suppressions: internal table, only service_role (which bypasses RLS) should access
CREATE POLICY "No public access" ON public.email_suppressions
  FOR ALL USING (false);

-- user_levels: readable by authenticated users, writes handled by service_role
CREATE POLICY "Authenticated users can read all levels" ON public.user_levels
  FOR SELECT TO authenticated USING (true);
;
