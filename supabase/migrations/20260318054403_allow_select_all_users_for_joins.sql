
-- The old policy required is_public=true OR id=auth.uid(), which caused
-- comment/kudos joins to return NULL for non-public users (showing "anonymous").
-- Username and avatar are not sensitive — is_public controls full profile page
-- access at the application layer, not basic identity in feeds.
DROP POLICY "Public profiles are viewable by everyone" ON public.users;

CREATE POLICY "Users are readable by everyone"
  ON public.users
  FOR SELECT
  USING (true);
;
