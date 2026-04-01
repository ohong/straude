
CREATE OR REPLACE FUNCTION public.calculate_user_streak(p_user_id UUID, p_freeze_days INTEGER DEFAULT 0)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  streak_count INTEGER := 0;
  current_date_check DATE;
  has_usage BOOLEAN;
  latest_date DATE;
  user_tz TEXT;
  user_today DATE;
  grace INTEGER;
BEGIN
  -- Look up the user's timezone, fall back to UTC
  SELECT COALESCE(NULLIF(timezone, ''), 'UTC') INTO user_tz
  FROM public.users
  WHERE id = p_user_id;

  IF user_tz IS NULL THEN
    user_tz := 'UTC';
  END IF;

  -- Safely compute "today" in the user's local timezone, falling back to UTC on bad tz
  BEGIN
    user_today := (NOW() AT TIME ZONE user_tz)::date;
  EXCEPTION WHEN OTHERS THEN
    user_today := (NOW() AT TIME ZONE 'UTC')::date;
  END;

  -- 1-day grace (can still push today) + freeze days
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
$$;
;
