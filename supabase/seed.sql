-- Local-only buckets that production normally provisions separately.
-- Safe to run repeatedly.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  (
    'avatars',
    'avatars',
    true,
    5242880,
    ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
  ),
  (
    'post-images',
    'post-images',
    true,
    10485760,
    ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
  ),
  (
    'dm-attachments',
    'dm-attachments',
    false,
    10485760,
    ARRAY[
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'image/heic', 'image/heif',
      'application/pdf',
      'text/plain', 'text/markdown', 'text/csv',
      'application/json',
      'application/zip'
    ]
  )
ON CONFLICT (id) DO NOTHING;
