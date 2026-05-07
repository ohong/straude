-- Create corrections_log table
--
-- Purpose: provide an auditable record of any post-hoc corrections we apply to
-- usage rows (daily_usage / device_usage). Each repair pass writes one row per
-- affected (user_id, date, table) tuple, capturing the previous and new values
-- so we can reconstruct, replay, or roll back the change later.
--
-- First user: the legacy_codex_inflation_repair_2026_05 migration that
-- re-prices daily_usage rows where the older Codex aggregation pipeline
-- double-counted cached input tokens.

CREATE TABLE IF NOT EXISTS public.corrections_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  date date NOT NULL,
  table_name text NOT NULL,           -- 'daily_usage' or 'device_usage'
  reason text NOT NULL,               -- e.g. 'legacy_codex_inflation_repair_2026_05'
  previous_values jsonb NOT NULL,     -- snapshot of old row fields we touched
  new_values jsonb NOT NULL,          -- snapshot of new values
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS corrections_log_user_date_idx
  ON public.corrections_log (user_id, date);

CREATE INDEX IF NOT EXISTS corrections_log_reason_idx
  ON public.corrections_log (reason);

ALTER TABLE public.corrections_log ENABLE ROW LEVEL SECURITY;

-- Read-only for authenticated users on their own rows; service_role has
-- implicit full access (it bypasses RLS).
DROP POLICY IF EXISTS "users_read_own_corrections" ON public.corrections_log;
CREATE POLICY "users_read_own_corrections" ON public.corrections_log
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

REVOKE ALL ON public.corrections_log FROM anon;
REVOKE ALL ON public.corrections_log FROM authenticated;
GRANT SELECT ON public.corrections_log TO authenticated;
