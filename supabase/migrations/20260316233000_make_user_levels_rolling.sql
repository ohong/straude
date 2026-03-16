CREATE OR REPLACE FUNCTION public.recalculate_user_level(p_user_id uuid)
RETURNS public.user_levels
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  user_tz text;
  user_today date;
  window_start date;
  computed_level integer;
  current_cost numeric;
  current_active_days integer;
  result_row public.user_levels%ROWTYPE;
BEGIN
  SELECT COALESCE(NULLIF(timezone, ''), 'UTC')
  INTO user_tz
  FROM public.users
  WHERE id = p_user_id;

  IF user_tz IS NULL THEN
    user_tz := 'UTC';
  END IF;

  user_today := (now() AT TIME ZONE user_tz)::date;
  window_start := user_today - 29;

  SELECT
    COALESCE(SUM(d.cost_usd), 0),
    COUNT(DISTINCT d.date)::integer
  INTO current_cost, current_active_days
  FROM public.daily_usage d
  WHERE d.user_id = p_user_id
    AND d.date BETWEEN window_start AND user_today;

  computed_level := CASE
    WHEN current_active_days >= 28 AND current_cost >= 2000 THEN 8
    WHEN current_active_days >= 24 AND current_cost >= 1000 THEN 7
    WHEN current_active_days >= 20 AND current_cost >= 500 THEN 6
    WHEN current_active_days >= 15 AND current_cost >= 250 THEN 5
    WHEN current_active_days >= 10 AND current_cost >= 100 THEN 4
    WHEN current_active_days >= 7 AND current_cost >= 40 THEN 3
    WHEN current_active_days >= 3 AND current_cost >= 10 THEN 2
    WHEN current_active_days >= 1 AND current_cost >= 1 THEN 1
    ELSE 0
  END;

  IF computed_level = 0 THEN
    DELETE FROM public.user_levels
    WHERE user_id = p_user_id;
    RETURN NULL;
  END IF;

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
    computed_level,
    window_start,
    user_today,
    current_cost,
    current_active_days,
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
    promoted_at = CASE
      WHEN public.user_levels.level <> EXCLUDED.level THEN now()
      ELSE public.user_levels.promoted_at
    END,
    updated_at = now()
  RETURNING * INTO result_row;

  RETURN result_row;
END;
$$;

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
