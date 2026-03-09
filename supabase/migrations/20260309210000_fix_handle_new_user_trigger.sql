-- =============================================
-- Fix handle_new_user() — overwritten by Bao migration 20260306150625
--
-- The Bao schema migration replaced this function to insert into
-- public.profiles instead of public.users. Every signup since
-- March 6 2026 12:19 UTC is missing a public.users row.
--
-- This migration:
--   1. Restores the function to insert into public.users
--   2. Also inserts into public.profiles (Bao compatibility)
--   3. Backfills all missing public.users rows
-- =============================================

-- 1. Restore handle_new_user to insert into BOTH tables
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, github_username, avatar_url, timezone)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'user_name',
    NEW.raw_user_meta_data ->> 'avatar_url',
    COALESCE(NEW.raw_user_meta_data ->> 'timezone', 'UTC')
  )
  ON CONFLICT (id) DO NOTHING;

  -- Bao compatibility: also insert into profiles if table exists
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name'),
    NEW.raw_user_meta_data ->> 'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- 2. Backfill missing public.users rows from auth.users
INSERT INTO public.users (id, github_username, avatar_url, timezone)
SELECT
  a.id,
  a.raw_user_meta_data ->> 'user_name',
  a.raw_user_meta_data ->> 'avatar_url',
  COALESCE(a.raw_user_meta_data ->> 'timezone', 'UTC')
FROM auth.users a
LEFT JOIN public.users u ON a.id = u.id
WHERE u.id IS NULL
ON CONFLICT (id) DO NOTHING;
