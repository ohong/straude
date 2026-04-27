-- Tie post interaction visibility and writes to the parent post's visibility.
-- The original policies made comments, kudos, and comment reactions directly
-- readable through PostgREST even when the parent post was private.

DROP POLICY IF EXISTS "Anyone can view kudos" ON public.kudos;
CREATE POLICY "Anyone can view kudos on visible posts"
  ON public.kudos FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.posts p
      WHERE p.id = kudos.post_id
    )
  );

DROP POLICY IF EXISTS "Users can give kudos" ON public.kudos;
CREATE POLICY "Users can give kudos on visible posts"
  ON public.kudos FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.posts p
      WHERE p.id = kudos.post_id
    )
  );

DROP POLICY IF EXISTS "Anyone can view comments on visible posts" ON public.comments;
CREATE POLICY "Anyone can view comments on visible posts"
  ON public.comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.posts p
      WHERE p.id = comments.post_id
    )
  );

DROP POLICY IF EXISTS "Users can comment" ON public.comments;
CREATE POLICY "Users can comment on visible posts"
  ON public.comments FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.posts p
      WHERE p.id = comments.post_id
    )
  );

DROP POLICY IF EXISTS "Anyone can view comment reactions" ON public.comment_reactions;
CREATE POLICY "Anyone can view comment reactions on visible comments"
  ON public.comment_reactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.comments c
      WHERE c.id = comment_reactions.comment_id
    )
  );

DROP POLICY IF EXISTS "Users can react to comments" ON public.comment_reactions;
CREATE POLICY "Users can react to visible comments"
  ON public.comment_reactions FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.comments c
      WHERE c.id = comment_reactions.comment_id
    )
  );
