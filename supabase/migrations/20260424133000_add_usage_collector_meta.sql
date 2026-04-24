ALTER TABLE public.device_usage
  ADD COLUMN IF NOT EXISTS collector_meta jsonb;

ALTER TABLE public.daily_usage
  ADD COLUMN IF NOT EXISTS collector_meta jsonb;
