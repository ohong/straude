-- Team affiliation badge (v1)
-- Adds two columns to users for storing the user's affiliated organization URL
-- and the URL of a cached favicon, plus a public-read Storage bucket that
-- caches the favicons by domain so multiple users sharing the same org reuse
-- a single fetched image.

-- 1. Columns on users.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS team_url text,
  ADD COLUMN IF NOT EXISTS team_favicon_url text;

-- 2. Grant SELECT on the new columns to anon + authenticated.
-- The earlier harden_users_public_columns migration restricted column-level
-- SELECT on users; without these grants, INVOKER-rights RPCs (e.g. get_feed)
-- would silently drop the new columns when called by anon/authenticated roles.
-- UPDATE permission is already covered by the existing
-- "Users can update own profile" RLS policy, which is column-agnostic.
GRANT SELECT (team_url, team_favicon_url) ON public.users TO anon, authenticated;

-- 3. Public-read Storage bucket for cached team favicons.
-- Object key is `<domain>.png` (e.g. `anthropic.com.png`). Only the service
-- role writes to this bucket; everyone reads via the public URL.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'team-favicons',
  'team-favicons',
  true,
  524288, -- 512 KB; favicons are tiny.
  ARRAY[
    'image/png',
    'image/jpeg',
    'image/svg+xml',
    'image/x-icon',
    'image/vnd.microsoft.icon',
    'image/webp'
  ]
) ON CONFLICT (id) DO NOTHING;

-- 4. Storage RLS: explicit public read; no INSERT/UPDATE/DELETE policies for
-- anon/authenticated, so writes are restricted to the service role (which
-- bypasses RLS). This matches the existing convention used by the
-- dm-attachments bucket while removing per-user upload paths we don't need.
DROP POLICY IF EXISTS "Anyone can view team favicons" ON storage.objects;
CREATE POLICY "Anyone can view team favicons"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'team-favicons');
