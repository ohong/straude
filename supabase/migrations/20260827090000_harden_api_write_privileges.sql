-- Force security-sensitive writes through the validated, rate-limited API
-- routes. RLS still protects reads and acts as defense in depth, but browser
-- clients must not bypass the route handlers through PostgREST or Storage.

REVOKE UPDATE ON public.users FROM authenticated;

REVOKE INSERT, UPDATE ON public.daily_usage FROM authenticated;
REVOKE INSERT, UPDATE ON public.device_usage FROM authenticated;

REVOKE SELECT ON public.daily_usage FROM anon, authenticated;
GRANT SELECT (
  id,
  user_id,
  date,
  cost_usd,
  input_tokens,
  output_tokens,
  reasoning_output_tokens,
  cache_creation_tokens,
  cache_read_tokens,
  total_tokens,
  models,
  model_breakdown,
  session_count,
  is_verified,
  created_at,
  updated_at
) ON public.daily_usage TO anon, authenticated;

REVOKE INSERT, UPDATE, DELETE ON public.posts FROM authenticated;

REVOKE INSERT, DELETE ON public.follows FROM authenticated;
REVOKE INSERT, DELETE ON public.kudos FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.comments FROM authenticated;
REVOKE INSERT, DELETE ON public.comment_reactions FROM authenticated;

REVOKE INSERT, UPDATE ON public.notifications FROM authenticated;
GRANT UPDATE (read) ON public.notifications TO authenticated;

REVOKE INSERT ON public.direct_messages FROM authenticated;
REVOKE INSERT ON public.prompt_submissions FROM authenticated;
REVOKE INSERT ON public.company_suggestions FROM authenticated;

DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload post images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload dm attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own dm attachments" ON storage.objects;
