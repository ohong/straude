-- Fix: calculate_streaks_batch failed with "function is not unique" because
-- two overloads of calculate_user_streak existed: (uuid) and (uuid, integer DEFAULT 0).
-- Drop the redundant 1-arg version and disambiguate the batch call.

DROP FUNCTION IF EXISTS public.calculate_user_streak(uuid);

CREATE OR REPLACE FUNCTION public.calculate_streaks_batch(p_user_ids uuid[])
RETURNS TABLE(user_id uuid, streak integer)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT uid, public.calculate_user_streak(uid, 0)
  FROM unnest(p_user_ids) AS uid;
END;
$$;
