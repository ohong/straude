CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

  IF to_regclass('public.profiles') IS NOT NULL THEN
    EXECUTE $sql$
      INSERT INTO public.profiles (id, display_name, avatar_url)
      VALUES ($1, $2, $3)
      ON CONFLICT (id) DO NOTHING
    $sql$
    USING
      NEW.id,
      COALESCE(
        NEW.raw_user_meta_data ->> 'full_name',
        NEW.raw_user_meta_data ->> 'name'
      ),
      NEW.raw_user_meta_data ->> 'avatar_url';
  END IF;

  RETURN NEW;
END;
$$;
