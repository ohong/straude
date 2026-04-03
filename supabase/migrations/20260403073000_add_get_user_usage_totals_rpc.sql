-- Fast per-user usage totals for app chrome and profile surfaces.
-- Prevents transferring full daily_usage history to the app server.
CREATE OR REPLACE FUNCTION public.get_user_usage_totals(p_user_id uuid)
RETURNS TABLE (
  total_cost numeric,
  total_output_tokens bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $$
  SELECT
    COALESCE(SUM(d.cost_usd), 0)::numeric AS total_cost,
    COALESCE(SUM(d.output_tokens), 0)::bigint AS total_output_tokens
  FROM public.daily_usage d
  WHERE d.user_id = p_user_id
    AND (
      auth.uid() = p_user_id
      OR auth.role() = 'service_role'
    );
$$;

REVOKE ALL ON FUNCTION public.get_user_usage_totals(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_user_usage_totals(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_user_usage_totals(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_usage_totals(uuid) TO service_role;
