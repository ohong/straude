CREATE OR REPLACE FUNCTION admin_model_usage_by_day()
RETURNS TABLE(date date, claude_spend numeric, codex_spend numeric)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT d.date,
    COALESCE(SUM(CASE WHEN e.elem->>'model' LIKE 'claude-%'
      THEN (e.elem->>'cost_usd')::numeric ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN e.elem->>'model' IS NOT NULL
      AND e.elem->>'model' NOT LIKE 'claude-%'
      THEN (e.elem->>'cost_usd')::numeric ELSE 0 END), 0)
  FROM daily_usage d
  LEFT JOIN LATERAL jsonb_array_elements(d.model_breakdown) AS e(elem) ON true
  WHERE d.user_id::text NOT LIKE 'a0000000-0000-4000-8000-%'
  GROUP BY d.date ORDER BY d.date;
$$;;
