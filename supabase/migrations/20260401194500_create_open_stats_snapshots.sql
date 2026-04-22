CREATE TABLE IF NOT EXISTS public.open_stats_snapshots (
  snapshot_date date PRIMARY KEY,
  captured_at timestamptz NOT NULL DEFAULT now(),
  stats jsonb NOT NULL,
  CONSTRAINT open_stats_snapshots_stats_object
    CHECK (jsonb_typeof(stats) = 'object')
);
COMMENT ON TABLE public.open_stats_snapshots IS
  'Daily persisted snapshots for the public /open usage statistics page.';
ALTER TABLE public.open_stats_snapshots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.open_stats_snapshots FROM anon, authenticated;
