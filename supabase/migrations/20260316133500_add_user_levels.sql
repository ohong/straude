CREATE TABLE public.user_levels (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  level integer NOT NULL CHECK (level BETWEEN 1 AND 8),
  best_window_start date NOT NULL,
  best_window_end date NOT NULL,
  best_window_cost_usd numeric NOT NULL,
  best_window_active_days integer NOT NULL,
  promoted_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_levels ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.recalculate_user_level(p_user_id uuid)
RETURNS public.user_levels
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  computed record;
  existing_row public.user_levels%ROWTYPE;
  result_row public.user_levels%ROWTYPE;
BEGIN
  SELECT *
  INTO computed
  FROM (
    WITH candidate_windows AS (
      SELECT DISTINCT
        d.date AS best_window_end,
        (d.date - INTERVAL '29 days')::date AS best_window_start
      FROM public.daily_usage d
      WHERE d.user_id = p_user_id
    ),
    window_stats AS (
      SELECT
        cw.best_window_start,
        cw.best_window_end,
        COALESCE(SUM(du.cost_usd), 0) AS best_window_cost_usd,
        COUNT(DISTINCT du.date)::integer AS best_window_active_days
      FROM candidate_windows cw
      LEFT JOIN public.daily_usage du
        ON du.user_id = p_user_id
       AND du.date BETWEEN cw.best_window_start AND cw.best_window_end
      GROUP BY cw.best_window_start, cw.best_window_end
    )
    SELECT
      CASE
        WHEN ws.best_window_active_days >= 28 AND ws.best_window_cost_usd >= 2000 THEN 8
        WHEN ws.best_window_active_days >= 24 AND ws.best_window_cost_usd >= 1000 THEN 7
        WHEN ws.best_window_active_days >= 20 AND ws.best_window_cost_usd >= 500 THEN 6
        WHEN ws.best_window_active_days >= 15 AND ws.best_window_cost_usd >= 250 THEN 5
        WHEN ws.best_window_active_days >= 10 AND ws.best_window_cost_usd >= 100 THEN 4
        WHEN ws.best_window_active_days >= 7 AND ws.best_window_cost_usd >= 40 THEN 3
        WHEN ws.best_window_active_days >= 3 AND ws.best_window_cost_usd >= 10 THEN 2
        WHEN ws.best_window_active_days >= 1 AND ws.best_window_cost_usd >= 1 THEN 1
        ELSE 0
      END AS level,
      ws.best_window_start,
      ws.best_window_end,
      ws.best_window_cost_usd,
      ws.best_window_active_days
    FROM window_stats ws
  ) ranked_windows
  WHERE ranked_windows.level > 0
  ORDER BY
    ranked_windows.level DESC,
    ranked_windows.best_window_end DESC,
    ranked_windows.best_window_cost_usd DESC,
    ranked_windows.best_window_active_days DESC
  LIMIT 1;

  SELECT *
  INTO existing_row
  FROM public.user_levels
  WHERE user_id = p_user_id;

  IF computed IS NULL THEN
    IF existing_row.user_id IS NOT NULL THEN
      existing_row.updated_at := now();

      UPDATE public.user_levels
      SET updated_at = existing_row.updated_at
      WHERE user_id = p_user_id
      RETURNING * INTO result_row;

      RETURN result_row;
    END IF;

    RETURN NULL;
  END IF;

  IF existing_row.user_id IS NULL OR computed.level > existing_row.level THEN
    INSERT INTO public.user_levels (
      user_id,
      level,
      best_window_start,
      best_window_end,
      best_window_cost_usd,
      best_window_active_days,
      promoted_at,
      updated_at
    )
    VALUES (
      p_user_id,
      computed.level,
      computed.best_window_start,
      computed.best_window_end,
      computed.best_window_cost_usd,
      computed.best_window_active_days,
      now(),
      now()
    )
    ON CONFLICT (user_id) DO UPDATE
    SET
      level = EXCLUDED.level,
      best_window_start = EXCLUDED.best_window_start,
      best_window_end = EXCLUDED.best_window_end,
      best_window_cost_usd = EXCLUDED.best_window_cost_usd,
      best_window_active_days = EXCLUDED.best_window_active_days,
      promoted_at = EXCLUDED.promoted_at,
      updated_at = EXCLUDED.updated_at
    RETURNING * INTO result_row;

    RETURN result_row;
  END IF;

  IF computed.level = existing_row.level
    AND (
      computed.best_window_end > existing_row.best_window_end
      OR (
        computed.best_window_end = existing_row.best_window_end
        AND computed.best_window_cost_usd > existing_row.best_window_cost_usd
      )
    )
  THEN
    UPDATE public.user_levels
    SET
      best_window_start = computed.best_window_start,
      best_window_end = computed.best_window_end,
      best_window_cost_usd = computed.best_window_cost_usd,
      best_window_active_days = computed.best_window_active_days,
      updated_at = now()
    WHERE user_id = p_user_id
    RETURNING * INTO result_row;

    RETURN result_row;
  END IF;

  UPDATE public.user_levels
  SET updated_at = now()
  WHERE user_id = p_user_id
  RETURNING * INTO result_row;

  RETURN result_row;
END;
$$;
REVOKE ALL ON FUNCTION public.recalculate_user_level(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.recalculate_user_level(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.recalculate_user_level(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_user_level(uuid) TO service_role;
DO $$
DECLARE
  target_user_id uuid;
BEGIN
  FOR target_user_id IN
    SELECT DISTINCT d.user_id
    FROM public.daily_usage d
  LOOP
    PERFORM public.recalculate_user_level(target_user_id);
  END LOOP;
END;
$$;
