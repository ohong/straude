CREATE OR REPLACE FUNCTION admin_model_share_by_day()
RETURNS TABLE(date date, model_family text, spend numeric)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT
    d.date,
    CASE
      WHEN e.elem->>'model' LIKE 'claude-%-opus%'
        OR e.elem->>'model' LIKE 'claude-opus-%'     THEN 'Opus'
      WHEN e.elem->>'model' LIKE 'claude-%-sonnet%'
        OR e.elem->>'model' LIKE 'claude-sonnet-%'    THEN 'Sonnet'
      WHEN e.elem->>'model' LIKE 'claude-%-haiku%'
        OR e.elem->>'model' LIKE 'claude-haiku-%'     THEN 'Haiku'
      WHEN e.elem->>'model' LIKE 'claude-%'           THEN 'Claude (other)'
      WHEN e.elem->>'model' LIKE 'gpt-%'             THEN 'GPT'
      WHEN e.elem->>'model' LIKE 'o1%'
        OR e.elem->>'model' LIKE 'o3%'
        OR e.elem->>'model' LIKE 'o4%'               THEN 'OpenAI o-series'
      WHEN e.elem->>'model' IS NOT NULL               THEN 'Other'
    END AS model_family,
    COALESCE(SUM((e.elem->>'cost_usd')::numeric), 0) AS spend
  FROM daily_usage d
  JOIN users u ON u.id = d.user_id
  LEFT JOIN LATERAL jsonb_array_elements(d.model_breakdown) AS e(elem) ON true
  WHERE d.user_id::text NOT LIKE 'a0000000-0000-4000-8000-%'
    AND e.elem->>'model' IS NOT NULL
    AND d.date >= u.created_at::date
  GROUP BY d.date, model_family
  ORDER BY d.date;
$$;;
