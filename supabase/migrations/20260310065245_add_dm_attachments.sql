
-- 1. Add attachments column to direct_messages
ALTER TABLE public.direct_messages
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]';

-- 2. Relax content constraint: allow empty content when attachments are present
ALTER TABLE public.direct_messages
  DROP CONSTRAINT IF EXISTS direct_messages_content_check;

ALTER TABLE public.direct_messages
  ALTER COLUMN content DROP NOT NULL;

ALTER TABLE public.direct_messages
  ADD CONSTRAINT direct_messages_content_check
  CHECK (
    (content IS NOT NULL AND char_length(trim(content)) BETWEEN 1 AND 1000)
    OR (attachments IS NOT NULL AND jsonb_array_length(attachments) > 0)
  );

-- 3. Create public dm-attachments storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'dm-attachments',
  'dm-attachments',
  true,
  10485760,
  ARRAY[
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'image/heic', 'image/heif', 'application/octet-stream',
    'application/pdf',
    'text/plain', 'text/markdown', 'text/csv',
    'application/json',
    'application/zip'
  ]
) ON CONFLICT (id) DO NOTHING;

-- 4. Storage policies for dm-attachments
CREATE POLICY "Authenticated users can upload dm attachments"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'dm-attachments'
    AND auth.role() = 'authenticated'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Anyone can view dm attachments"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'dm-attachments');

CREATE POLICY "Users can delete own dm attachments"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'dm-attachments'
    AND auth.role() = 'authenticated'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );

-- 5. Drop and recreate get_direct_message_threads with attachment info
DROP FUNCTION IF EXISTS public.get_direct_message_threads(int);

CREATE FUNCTION public.get_direct_message_threads(p_limit int DEFAULT 50)
RETURNS TABLE (
  counterpart_id uuid,
  counterpart_username text,
  counterpart_avatar_url text,
  counterpart_display_name text,
  last_message_id uuid,
  last_message_content text,
  last_message_created_at timestamptz,
  last_message_sender_id uuid,
  last_message_is_from_me boolean,
  unread_count bigint,
  last_message_has_attachment boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH relevant AS (
    SELECT
      dm.*,
      CASE
        WHEN dm.sender_id = auth.uid() THEN dm.recipient_id
        ELSE dm.sender_id
      END AS counterpart_id
    FROM public.direct_messages dm
    WHERE dm.sender_id = auth.uid() OR dm.recipient_id = auth.uid()
  ),
  ranked AS (
    SELECT
      relevant.*,
      row_number() OVER (
        PARTITION BY relevant.counterpart_id
        ORDER BY relevant.created_at DESC
      ) AS row_num,
      count(*) FILTER (
        WHERE relevant.recipient_id = auth.uid() AND relevant.read_at IS NULL
      ) OVER (
        PARTITION BY relevant.counterpart_id
      ) AS unread_count
    FROM relevant
  )
  SELECT
    ranked.counterpart_id,
    users.username AS counterpart_username,
    users.avatar_url AS counterpart_avatar_url,
    users.display_name AS counterpart_display_name,
    ranked.id AS last_message_id,
    ranked.content AS last_message_content,
    ranked.created_at AS last_message_created_at,
    ranked.sender_id AS last_message_sender_id,
    ranked.sender_id = auth.uid() AS last_message_is_from_me,
    ranked.unread_count,
    jsonb_array_length(ranked.attachments) > 0 AS last_message_has_attachment
  FROM ranked
  JOIN public.users ON users.id = ranked.counterpart_id
  WHERE ranked.row_num = 1
  ORDER BY ranked.created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);
$$;

GRANT EXECUTE ON FUNCTION public.get_direct_message_threads(int) TO authenticated;
;
