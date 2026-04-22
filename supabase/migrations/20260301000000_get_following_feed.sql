-- Replace the two-query IN-clause pattern for the "following" feed tab
-- with a single efficient join between follows and posts.
CREATE OR REPLACE FUNCTION public.get_following_feed(
  p_user_id uuid,
  p_limit   int DEFAULT 20,
  p_cursor  timestamptz DEFAULT NULL
)
RETURNS TABLE (
  id              uuid,
  user_id         uuid,
  daily_usage_id  uuid,
  title           text,
  description     text,
  images          jsonb,
  created_at      timestamptz,
  updated_at      timestamptz,
  "user"          jsonb,
  daily_usage     jsonb,
  kudos_count     bigint,
  comment_count   bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.user_id,
    p.daily_usage_id,
    p.title,
    p.description,
    p.images,
    p.created_at,
    p.updated_at,
    to_jsonb(u.*) AS "user",
    to_jsonb(d.*) AS daily_usage,
    (SELECT COUNT(*) FROM public.kudos k WHERE k.post_id = p.id) AS kudos_count,
    (SELECT COUNT(*) FROM public.comments c WHERE c.post_id = p.id) AS comment_count
  FROM public.posts p
  JOIN public.users u ON u.id = p.user_id
  LEFT JOIN public.daily_usage d ON d.id = p.daily_usage_id
  WHERE (
    p.user_id = p_user_id
    OR EXISTS (
      SELECT 1 FROM public.follows f
      WHERE f.follower_id = p_user_id AND f.following_id = p.user_id
    )
  )
  AND (p_cursor IS NULL OR p.created_at < p_cursor)
  ORDER BY p.created_at DESC
  LIMIT p_limit;
END;
$$;
-- Allow authenticated users to call this function (runs under their session).
GRANT EXECUTE ON FUNCTION public.get_following_feed(uuid, int, timestamptz) TO authenticated;
