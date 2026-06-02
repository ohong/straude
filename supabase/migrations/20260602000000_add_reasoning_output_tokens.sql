ALTER TABLE public.device_usage
  ADD COLUMN IF NOT EXISTS reasoning_output_tokens BIGINT NOT NULL DEFAULT 0 CHECK (reasoning_output_tokens >= 0);

ALTER TABLE public.daily_usage
  ADD COLUMN IF NOT EXISTS reasoning_output_tokens BIGINT NOT NULL DEFAULT 0 CHECK (reasoning_output_tokens >= 0);
