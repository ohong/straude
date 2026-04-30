-- Fix: streak inconsistency across profile, recap, and sidebar (issue #100).
--
-- After the harden_users_public_columns migration restricted column-level
-- SELECT on public.users to a sanitized public subset, calculate_user_streak
-- (which reads users.timezone) started failing with "permission denied for
-- table users" whenever it was called by the authenticated/anon roles.
--
-- The profile page bypassed the failure because it calls the RPC via the
-- service-role client, but the sidebar and recap surfaces use the regular
-- server client (authenticated role) and silently fell back to 0 — producing
-- the inconsistency reported in the issue.
--
-- Promote the function to SECURITY DEFINER (with a fixed search_path) so it
-- can read users.timezone regardless of caller, then re-grant EXECUTE to the
-- API roles. The function's only inputs are user_id and freeze_days, neither
-- of which expand the data the caller can already see — every surface that
-- already calls it accepts an arbitrary user_id.

CREATE OR REPLACE FUNCTION public.calculate_user_streak(
  p_user_id UUID,
  p_freeze_days INTEGER DEFAULT 0
)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
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
$$;

GRANT EXECUTE ON FUNCTION public.calculate_user_streak(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_user_streak(UUID, INTEGER) TO anon;
