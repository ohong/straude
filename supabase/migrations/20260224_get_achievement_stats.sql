-- Aggregates achievement-related stats for a user in a single query.
-- Replaces client-side SELECT * + .reduce() pattern.
CREATE OR REPLACE FUNCTION public.get_achievement_stats(p_user_id uuid)
RETURNS TABLE (
  total_cost          numeric,
  total_output_tokens bigint,
  total_input_tokens  bigint,
  total_cache_tokens  bigint,
  total_sessions      bigint,
  max_daily_cost      numeric,
  sync_count          bigint,
  verified_sync_count bigint
) LANGUAGE plpgsql STABLE SET search_path TO 'public' AS $$
BEGIN
  RETURN QUERY SELECT
    COALESCE(SUM(d.cost_usd), 0)::numeric,
    COALESCE(SUM(d.output_tokens), 0)::bigint,
    COALESCE(SUM(d.input_tokens), 0)::bigint,
    COALESCE(SUM(COALESCE(d.cache_creation_tokens, 0) + COALESCE(d.cache_read_tokens, 0)), 0)::bigint,
    COALESCE(SUM(COALESCE(d.session_count, 1)), 0)::bigint,
    COALESCE(MAX(d.cost_usd), 0)::numeric,
    COUNT(*)::bigint,
    COUNT(*) FILTER (WHERE d.is_verified)::bigint
  FROM public.daily_usage d WHERE d.user_id = p_user_id;
END; $$;

-- Only service_role can call this (achievements are awarded server-side).
REVOKE ALL ON FUNCTION public.get_achievement_stats(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_achievement_stats(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.get_achievement_stats(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_achievement_stats(uuid) TO service_role;
