ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS heard_about TEXT CHECK (char_length(heard_about) <= 500);
