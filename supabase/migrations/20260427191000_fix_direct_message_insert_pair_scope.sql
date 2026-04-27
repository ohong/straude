-- Fix the direct_messages INSERT policy so the existing-thread exception is
-- scoped to the sender/recipient pair being inserted. Unqualified sender_id and
-- recipient_id inside the subquery can bind to the inner dm row instead of the
-- outer inserted row.

REVOKE UPDATE ON public.direct_messages FROM authenticated;
GRANT UPDATE (read_at) ON public.direct_messages TO authenticated;

DROP POLICY IF EXISTS "Users can send direct messages" ON public.direct_messages;
CREATE POLICY "Users can send direct messages"
  ON public.direct_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = direct_messages.sender_id
    AND EXISTS (
      SELECT 1
      FROM public.users recipient
      WHERE recipient.id = direct_messages.recipient_id
        AND (
          recipient.is_public
          OR EXISTS (
            SELECT 1
            FROM public.direct_messages dm
            WHERE (
              dm.sender_id = direct_messages.sender_id
              AND dm.recipient_id = direct_messages.recipient_id
            )
            OR (
              dm.sender_id = direct_messages.recipient_id
              AND dm.recipient_id = direct_messages.sender_id
            )
          )
        )
    )
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(direct_messages.attachments, '[]'::jsonb)) AS attachment
      WHERE jsonb_typeof(attachment) <> 'object'
        OR attachment->>'bucket' <> 'dm-attachments'
        OR NULLIF(attachment->>'path', '') IS NULL
        OR left(attachment->>'path', 1) = '/'
        OR position('..' IN attachment->>'path') > 0
        OR split_part(attachment->>'path', '/', 1) <> auth.uid()::text
    )
  );
