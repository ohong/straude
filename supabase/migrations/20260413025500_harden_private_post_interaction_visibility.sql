-- Ensure interaction tables inherit the same visibility rules as their parent
-- post. Without this, comments/kudos/reactions can be read directly through
-- PostgREST even when the post itself is private.

DROP POLICY IF EXISTS "Anyone can view kudos" ON public.kudos;
CREATE POLICY "Visible post kudos are readable"
  ON public.kudos FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.posts p
      JOIN public.users u ON u.id = p.user_id
      WHERE p.id = kudos.post_id
        AND (
          u.is_public = true
          OR p.user_id = (select auth.uid())
          OR EXISTS (
            SELECT 1
            FROM public.follows f
            WHERE f.follower_id = (select auth.uid())
              AND f.following_id = p.user_id
          )
        )
    )
  );

DROP POLICY IF EXISTS "Anyone can view comments on visible posts" ON public.comments;
CREATE POLICY "Visible post comments are readable"
  ON public.comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.posts p
      JOIN public.users u ON u.id = p.user_id
      WHERE p.id = comments.post_id
        AND (
          u.is_public = true
          OR p.user_id = (select auth.uid())
          OR EXISTS (
            SELECT 1
            FROM public.follows f
            WHERE f.follower_id = (select auth.uid())
              AND f.following_id = p.user_id
          )
        )
    )
  );

DROP POLICY IF EXISTS "Anyone can view comment reactions" ON public.comment_reactions;
CREATE POLICY "Visible post comment reactions are readable"
  ON public.comment_reactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.comments c
      JOIN public.posts p ON p.id = c.post_id
      JOIN public.users u ON u.id = p.user_id
      WHERE c.id = comment_reactions.comment_id
        AND (
          u.is_public = true
          OR p.user_id = (select auth.uid())
          OR EXISTS (
            SELECT 1
            FROM public.follows f
            WHERE f.follower_id = (select auth.uid())
              AND f.following_id = p.user_id
          )
        )
    )
  );
