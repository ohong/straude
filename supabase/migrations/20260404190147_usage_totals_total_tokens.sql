-- Switch get_user_usage_totals from output_tokens to total_tokens so the
-- sidebar shows all-time total tokens (input + output + cache).
DROP FUNCTION IF EXISTS public.get_user_usage_totals(uuid);
CREATE FUNCTION public.get_user_usage_totals(p_user_id uuid)
RETURNS TABLE (total_cost numeric, total_tokens bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT
    COALESCE(SUM(d.cost_usd), 0)::numeric AS total_cost,
    COALESCE(SUM(d.total_tokens), 0)::bigint AS total_tokens
  FROM public.daily_usage d
  WHERE d.user_id = p_user_id
    AND (
      auth.uid() = p_user_id
      OR auth.role() = 'service_role'
    );
$$;
GRANT EXECUTE ON FUNCTION public.get_user_usage_totals(uuid) TO authenticated;
