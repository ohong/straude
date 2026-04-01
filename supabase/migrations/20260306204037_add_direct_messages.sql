ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS email_dm_notifications boolean NOT NULL DEFAULT true;

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('follow', 'kudos', 'comment', 'mention', 'message'));

CREATE TABLE IF NOT EXISTS public.direct_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (char_length(trim(content)) BETWEEN 1 AND 1000),
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT direct_messages_no_self CHECK (sender_id <> recipient_id)
);

CREATE INDEX IF NOT EXISTS idx_direct_messages_sender_created_at
  ON public.direct_messages(sender_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_direct_messages_recipient_created_at
  ON public.direct_messages(recipient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_direct_messages_recipient_unread
  ON public.direct_messages(recipient_id, created_at DESC)
  WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_direct_messages_pair_created_at
  ON public.direct_messages(
    LEAST(sender_id, recipient_id),
    GREATEST(sender_id, recipient_id),
    created_at DESC
  );

ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own direct messages" ON public.direct_messages;
CREATE POLICY "Users can read own direct messages"
  ON public.direct_messages FOR SELECT
  TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

DROP POLICY IF EXISTS "Users can send direct messages" ON public.direct_messages;
CREATE POLICY "Users can send direct messages"
  ON public.direct_messages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "Recipients can mark direct messages read" ON public.direct_messages;
CREATE POLICY "Recipients can mark direct messages read"
  ON public.direct_messages FOR UPDATE
  TO authenticated
  USING (auth.uid() = recipient_id)
  WITH CHECK (auth.uid() = recipient_id);

CREATE OR REPLACE FUNCTION public.get_direct_message_threads(p_limit int DEFAULT 50)
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
  unread_count bigint
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
    ranked.unread_count
  FROM ranked
  JOIN public.users ON users.id = ranked.counterpart_id
  WHERE ranked.row_num = 1
  ORDER BY ranked.created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);
$$;

GRANT SELECT, INSERT, UPDATE ON public.direct_messages TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_direct_message_threads(int) TO authenticated;;
