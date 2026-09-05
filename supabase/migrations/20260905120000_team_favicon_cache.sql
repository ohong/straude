-- Service-only metadata persists both formats and short-lived misses across workers.
CREATE TABLE public.team_favicon_cache (
  domain text PRIMARY KEY,
  object_path text,
  retry_after timestamptz,
  CONSTRAINT team_favicon_cache_result CHECK (
    (object_path IS NOT NULL AND retry_after IS NULL
      AND object_path IN (domain || '.svg', domain || '.png'))
    OR (object_path IS NULL AND retry_after IS NOT NULL)
  )
);

ALTER TABLE public.team_favicon_cache ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.team_favicon_cache FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_favicon_cache TO service_role;
