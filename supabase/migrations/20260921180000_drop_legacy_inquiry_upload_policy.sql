-- NOT YET APPLIED. Run only AFTER the updated site code (private inquiry-uploads bucket) is live.
-- Removes the old rule that let anonymous visitors upload into media/inquiries.
drop policy if exists media_public_insert_inquiries on storage.objects;
