-- Add "user" feed type so profile pages can fetch any user's posts without
-- requiring auth.uid() to match p_user_id.  The calling code is responsible
-- for its own access-control check (canView) before invoking this type.
CREATE OR REPLACE FUNCTION public.get_feed(
  p_type              text,
  p_user_id           uuid        DEFAULT NULL,
  p_limit             int         DEFAULT 20,
  p_cursor_date       date        DEFAULT NULL,
  p_cursor_created_at timestamptz DEFAULT NULL
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
DECLARE
  v_auth_user_id uuid := auth.uid();
BEGIN
  IF p_type IN ('mine', 'following') THEN
    IF v_auth_user_id IS NULL OR p_user_id IS NULL OR p_user_id <> v_auth_user_id THEN
      RAISE EXCEPTION 'Unauthorized'
        USING ERRCODE = '42501';
    END IF;
  ELSIF p_type = 'user' THEN
    IF p_user_id IS NULL THEN
      RAISE EXCEPTION 'user_id is required for user feed type'
        USING ERRCODE = '22023';
    END IF;
  ELSIF p_type <> 'global' THEN
    RAISE EXCEPTION 'Invalid feed type: %', p_type
      USING ERRCODE = '22023';
  END IF;

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
    (SELECT COUNT(*) FROM public.kudos k WHERE k.post_id = p.id)   AS kudos_count,
    (SELECT COUNT(*) FROM public.comments c WHERE c.post_id = p.id) AS comment_count
  FROM public.posts p
  JOIN public.users       u ON u.id = p.user_id
  JOIN public.daily_usage d ON d.id = p.daily_usage_id
  WHERE
    CASE p_type
      WHEN 'global'    THEN u.is_public = true
      WHEN 'mine'      THEN p.user_id = p_user_id
      WHEN 'user'      THEN p.user_id = p_user_id
      WHEN 'following' THEN
        p.user_id = p_user_id
        OR EXISTS (
          SELECT 1 FROM public.follows f
          WHERE f.follower_id = p_user_id AND f.following_id = p.user_id
        )
      ELSE false
    END
    AND CASE
      WHEN p_cursor_date IS NULL AND p_cursor_created_at IS NULL THEN true
      WHEN p_cursor_date IS NOT NULL THEN
        d.date < p_cursor_date
        OR (d.date = p_cursor_date AND p.created_at < p_cursor_created_at)
      ELSE
        p.created_at < p_cursor_created_at
    END
  ORDER BY d.date DESC, p.created_at DESC
  LIMIT p_limit;
END;
$$;
