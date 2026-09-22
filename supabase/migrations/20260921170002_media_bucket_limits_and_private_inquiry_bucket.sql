-- Applied to the Thornwood demo project on 2026-09-21.
update storage.buckets
   set file_size_limit = 5242880,
       allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif']
 where id = 'media';

drop policy if exists media_public_read on storage.objects;
create policy media_public_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] is distinct from 'inquiries');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('inquiry-uploads', 'inquiry-uploads', false, 5242880, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update
  set public = false, file_size_limit = 5242880,
      allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif'];

drop policy if exists inquiry_uploads_public_insert on storage.objects;
create policy inquiry_uploads_public_insert on storage.objects
  for insert to anon, authenticated with check (bucket_id = 'inquiry-uploads');
drop policy if exists inquiry_uploads_admin_read on storage.objects;
create policy inquiry_uploads_admin_read on storage.objects
  for select to authenticated using (bucket_id = 'inquiry-uploads');
drop policy if exists inquiry_uploads_admin_delete on storage.objects;
create policy inquiry_uploads_admin_delete on storage.objects
  for delete to authenticated using (bucket_id = 'inquiry-uploads');
