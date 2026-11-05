-- Keep a durable deletion marker so in-flight profile saves cannot restore PII.
-- No new public column grants: only the service client needs this marker.
ALTER TABLE public.users ADD COLUMN deleted_at timestamptz;

-- Recognize the existing deletion flow only when both its exact per-user
-- tombstone and an Auth ban are present; a similarly named active user is safe.
UPDATE public.users AS u
SET deleted_at = now(), team_url = NULL, team_favicon_url = NULL
FROM auth.users AS a
WHERE a.id = u.id
  AND u.username = 'deleted_' || left(u.id::text, 8)
  AND a.banned_until > now();
