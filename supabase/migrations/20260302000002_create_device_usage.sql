CREATE TABLE IF NOT EXISTS public.device_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  device_id UUID NOT NULL,
  device_name TEXT,
  date DATE NOT NULL,
  cost_usd DECIMAL(10, 4) NOT NULL,
  input_tokens BIGINT NOT NULL,
  output_tokens BIGINT NOT NULL,
  cache_creation_tokens BIGINT DEFAULT 0,
  cache_read_tokens BIGINT DEFAULT 0,
  total_tokens BIGINT NOT NULL,
  models JSONB DEFAULT '[]',
  model_breakdown JSONB,
  session_count INTEGER DEFAULT 1,
  raw_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date, device_id)
);

CREATE INDEX idx_device_usage_user_date ON public.device_usage(user_id, date);
CREATE INDEX idx_device_usage_device ON public.device_usage(device_id);

ALTER TABLE public.device_usage ENABLE ROW LEVEL SECURITY;

-- Users can only see/write their own device usage
CREATE POLICY "Users can view own device usage" ON public.device_usage FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own device usage" ON public.device_usage FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own device usage" ON public.device_usage FOR UPDATE USING (user_id = auth.uid());

REVOKE ALL ON public.device_usage FROM anon;
REVOKE ALL ON public.device_usage FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON public.device_usage TO authenticated;
