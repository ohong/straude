-- Harden DM attachment storage privacy.
-- DM attachments should never be publicly readable/listable.

-- Ensure the bucket is private.
UPDATE storage.buckets
SET public = false
WHERE id = 'dm-attachments';
-- Remove overly broad read policy.
DROP POLICY IF EXISTS "Anyone can view dm attachments" ON storage.objects;
-- Allow reads only to authenticated users who are participants in a DM
-- that references the exact attachment path.
DROP POLICY IF EXISTS "DM participants can view dm attachments" ON storage.objects;
CREATE POLICY "DM participants can view dm attachments"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'dm-attachments'
    AND auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1
      FROM public.direct_messages dm
      WHERE (dm.sender_id = auth.uid() OR dm.recipient_id = auth.uid())
        AND dm.attachments @> jsonb_build_array(
          jsonb_build_object('bucket', 'dm-attachments', 'path', name)
        )
    )
  );
