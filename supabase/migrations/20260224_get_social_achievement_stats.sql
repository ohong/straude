-- Aggregates social achievement stats for a user in a single query.
-- Counts kudos received, kudos sent, comments received, and comments sent.
-- Self-interactions (kudos/comments on own posts) are counted intentionally.
CREATE OR REPLACE FUNCTION public.get_social_achievement_stats(p_user_id uuid)
RETURNS TABLE (
  kudos_received    bigint,
  kudos_sent        bigint,
  comments_received bigint,
  comments_sent     bigint
) LANGUAGE plpgsql STABLE SET search_path TO 'public' AS $$
BEGIN
  RETURN QUERY SELECT
    (SELECT COUNT(*) FROM public.kudos k
       JOIN public.posts p ON k.post_id = p.id
       WHERE p.user_id = p_user_id)::bigint,
    (SELECT COUNT(*) FROM public.kudos
       WHERE user_id = p_user_id)::bigint,
    (SELECT COUNT(*) FROM public.comments c
       JOIN public.posts p ON c.post_id = p.id
       WHERE p.user_id = p_user_id)::bigint,
    (SELECT COUNT(*) FROM public.comments
       WHERE user_id = p_user_id)::bigint;
END; $$;

-- Only service_role can call this (achievements are awarded server-side).
REVOKE ALL ON FUNCTION public.get_social_achievement_stats(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_social_achievement_stats(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.get_social_achievement_stats(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_social_achievement_stats(uuid) TO service_role;
