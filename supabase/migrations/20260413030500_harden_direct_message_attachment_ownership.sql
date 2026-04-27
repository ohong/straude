-- Prevent users from referencing another user's DM attachment path when
-- inserting a direct message through PostgREST.

REVOKE UPDATE ON public.direct_messages FROM authenticated;
GRANT UPDATE (read_at) ON public.direct_messages TO authenticated;

DROP POLICY IF EXISTS "Users can send direct messages" ON public.direct_messages;
CREATE POLICY "Users can send direct messages"
  ON public.direct_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1
      FROM public.users recipient
      WHERE recipient.id = recipient_id
        AND (
          recipient.is_public
          OR EXISTS (
            SELECT 1
            FROM public.direct_messages dm
            WHERE (
              dm.sender_id = sender_id
              AND dm.recipient_id = recipient_id
            )
            OR (
              dm.sender_id = recipient_id
              AND dm.recipient_id = sender_id
            )
          )
        )
    )
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(attachments, '[]'::jsonb)) AS attachment
      WHERE jsonb_typeof(attachment) <> 'object'
        OR attachment->>'bucket' <> 'dm-attachments'
        OR NULLIF(attachment->>'path', '') IS NULL
        OR left(attachment->>'path', 1) = '/'
        OR position('..' IN attachment->>'path') > 0
        OR split_part(attachment->>'path', '/', 1) <> auth.uid()::text
    )
  );
