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
  );
