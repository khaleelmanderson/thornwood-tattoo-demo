-- Applied to the Thornwood demo project on 2026-09-21.
-- Harden public inquiry inserts: only status 'new', bounded field lengths, server-side notified flag.
alter table public.inquiries add column if not exists notified_at timestamptz;

alter table public.inquiries drop constraint if exists inquiries_field_lengths;
alter table public.inquiries add constraint inquiries_field_lengths check (
  char_length(name) between 1 and 100
  and char_length(email) between 3 and 200
  and (phone is null or char_length(phone) <= 40)
  and (placement is null or char_length(placement) <= 100)
  and (size_estimate is null or char_length(size_estimate) <= 100)
  and (message is null or char_length(message) <= 4000)
  and (reference_image_url is null or char_length(reference_image_url) <= 500)
);

drop policy if exists inquiries_public_insert on public.inquiries;
create policy inquiries_public_insert on public.inquiries
  for insert to anon, authenticated
  with check (status = 'new' and notified_at is null);
