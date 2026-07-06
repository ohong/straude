-- Security sweep: close CLI device-flow token hijacking and add durable API rate limits.

-- Expire legacy login codes because the protocol now requires per-flow secrets
-- that older rows do not have. These are short-lived, one-time login artifacts,
-- not durable user credentials.
UPDATE public.cli_auth_codes
SET status = 'expired'
WHERE status <> 'expired';

ALTER TABLE public.cli_auth_codes
  ADD COLUMN IF NOT EXISTS poll_secret_hash text,
  ADD COLUMN IF NOT EXISTS verify_secret_hash text,
  ADD COLUMN IF NOT EXISTS redeemed_at timestamptz;

ALTER TABLE public.cli_auth_codes
  DROP CONSTRAINT IF EXISTS cli_auth_codes_status_check;

ALTER TABLE public.cli_auth_codes
  ADD CONSTRAINT cli_auth_codes_status_check
  CHECK (status IN ('pending', 'completed', 'expired', 'used'));

ALTER TABLE public.cli_auth_codes
  DROP CONSTRAINT IF EXISTS cli_auth_codes_active_secrets_check;

ALTER TABLE public.cli_auth_codes
  ADD CONSTRAINT cli_auth_codes_active_secrets_check
  CHECK (
    status = 'expired'
    OR (poll_secret_hash IS NOT NULL AND verify_secret_hash IS NOT NULL)
  );

DROP POLICY IF EXISTS "Service role manages cli auth codes" ON public.cli_auth_codes;
DROP POLICY IF EXISTS "Users can view own cli auth codes" ON public.cli_auth_codes;
DROP POLICY IF EXISTS "Authenticated users can verify pending codes" ON public.cli_auth_codes;

REVOKE ALL ON TABLE public.cli_auth_codes FROM anon;
REVOKE ALL ON TABLE public.cli_auth_codes FROM authenticated;
GRANT ALL ON TABLE public.cli_auth_codes TO service_role;

CREATE TABLE IF NOT EXISTS public.api_rate_limits (
  name text NOT NULL,
  subject text NOT NULL,
  window_start timestamptz NOT NULL,
  count integer NOT NULL DEFAULT 0 CHECK (count >= 0),
  expires_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (name, subject)
);

ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.api_rate_limits FROM anon;
REVOKE ALL ON TABLE public.api_rate_limits FROM authenticated;
GRANT ALL ON TABLE public.api_rate_limits TO service_role;

CREATE INDEX IF NOT EXISTS idx_api_rate_limits_expires_at
  ON public.api_rate_limits(expires_at);

CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_name text,
  p_subject text,
  p_limit integer,
  p_window_seconds integer DEFAULT 60
)
RETURNS TABLE(allowed boolean, retry_after_seconds integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now timestamptz := now();
  v_window interval;
  v_count integer;
  v_expires_at timestamptz;
BEGIN
  IF p_name IS NULL OR length(p_name) = 0
    OR p_subject IS NULL OR length(p_subject) = 0
    OR p_limit IS NULL OR p_limit <= 0
    OR p_window_seconds IS NULL OR p_window_seconds <= 0
  THEN
    RETURN QUERY SELECT false, 60;
    RETURN;
  END IF;

  v_window := make_interval(secs => p_window_seconds);

  DELETE FROM public.api_rate_limits
  WHERE expires_at < v_now - interval '1 hour';

  INSERT INTO public.api_rate_limits AS rl (
    name,
    subject,
    window_start,
    count,
    expires_at,
    updated_at
  )
  VALUES (
    p_name,
    p_subject,
    v_now,
    1,
    v_now + v_window,
    v_now
  )
  ON CONFLICT (name, subject) DO UPDATE
  SET
    count = CASE
      WHEN rl.expires_at <= v_now THEN 1
      ELSE rl.count + 1
    END,
    window_start = CASE
      WHEN rl.expires_at <= v_now THEN v_now
      ELSE rl.window_start
    END,
    expires_at = CASE
      WHEN rl.expires_at <= v_now THEN v_now + v_window
      ELSE rl.expires_at
    END,
    updated_at = v_now
  RETURNING rl.count, rl.expires_at
  INTO v_count, v_expires_at;

  RETURN QUERY SELECT
    v_count <= p_limit,
    CASE
      WHEN v_count <= p_limit THEN 0
      ELSE greatest(1, ceil(extract(epoch FROM (v_expires_at - v_now)))::integer)
    END;
END;
$$;

REVOKE ALL ON FUNCTION public.check_rate_limit(text, text, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_rate_limit(text, text, integer, integer) FROM anon;
REVOKE ALL ON FUNCTION public.check_rate_limit(text, text, integer, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, text, integer, integer) TO service_role;
