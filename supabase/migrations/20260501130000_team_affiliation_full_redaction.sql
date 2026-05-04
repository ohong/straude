-- Re-state the public.users sanitized SELECT list (now including the team
-- affiliation columns added in 20260501120000_add_team_affiliation.sql) and
-- update get_feed to surface the same redacted shape.
--
-- The standing convention (enforced by __tests__/unit/migration-safety.test.ts)
-- is that the LATEST users-grant migration enumerates the full sanitized
-- column list, and the LATEST get_feed redefinition uses jsonb_build_object
-- to allow-list user fields. Lazy partial grants (just adding the new
-- columns) bypass the full-list invariant and would let future maintainers
-- accidentally regress the redaction guarantee.

REVOKE ALL ON public.users FROM anon;
GRANT SELECT (
  id,
  username,
  display_name,
  bio,
  avatar_url,
  country,
  region,
  link,
  github_username,
  team_url,
  team_favicon_url,
  is_public
) ON public.users TO anon;

REVOKE ALL ON public.users FROM authenticated;
GRANT UPDATE ON public.users TO authenticated;
GRANT SELECT (
  id,
  username,
  display_name,
  bio,
  avatar_url,
  country,
  region,
  link,
  github_username,
  team_url,
  team_favicon_url,
  is_public
) ON public.users TO authenticated;

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
  v_can_view_user boolean := false;
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

    SELECT EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = p_user_id
        AND (
          u.is_public = true
          OR u.id = v_auth_user_id
          OR (
            v_auth_user_id IS NOT NULL
            AND EXISTS (
              SELECT 1
              FROM public.follows f
              WHERE f.follower_id = v_auth_user_id
                AND f.following_id = u.id
            )
          )
        )
    ) INTO v_can_view_user;

    IF NOT v_can_view_user THEN
      RAISE EXCEPTION 'Forbidden'
        USING ERRCODE = '42501';
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
    jsonb_build_object(
      'id', u.id,
      'username', u.username,
      'display_name', u.display_name,
      'bio', u.bio,
      'avatar_url', u.avatar_url,
      'country', u.country,
      'region', u.region,
      'link', u.link,
      'github_username', u.github_username,
      'team_url', u.team_url,
      'team_favicon_url', u.team_favicon_url,
      'is_public', u.is_public
    ) AS "user",
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

GRANT EXECUTE ON FUNCTION public.get_feed(text, uuid, int, date, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_feed(text, uuid, int, date, timestamptz) TO anon;
