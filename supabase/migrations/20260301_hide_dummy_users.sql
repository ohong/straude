-- Hide dummy/seed users from public surfaces (leaderboards, suggested friends, landing feed).
-- All public queries already filter on is_public = true, so no app code changes needed.
UPDATE public.users
SET is_public = false
WHERE id IN (
  SELECT id FROM auth.users WHERE email LIKE '%@example.com'
);
