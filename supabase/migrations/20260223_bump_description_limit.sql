-- Bump post description limit from 500 to 5000 characters
ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_description_check;
ALTER TABLE posts ADD CONSTRAINT posts_description_check CHECK (char_length(description) <= 5000);
