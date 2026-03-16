-- Align DM attachments with the private direct-message contract.
-- Existing environments may still have the original public bucket/policy.

UPDATE storage.buckets
SET public = false
WHERE id = 'dm-attachments';

DROP POLICY IF EXISTS "Anyone can view dm attachments" ON storage.objects;
