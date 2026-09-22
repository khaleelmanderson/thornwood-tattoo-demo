-- Applied to the Thornwood demo project on 2026-09-21.
-- For a new client project, replace the project ref in the URL below.
create extension if not exists pg_net with schema extensions;

create or replace function public.notify_new_inquiry()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  perform net.http_post(
    url     := 'https://bhpfrrksglqxmmtvokpb.supabase.co/functions/v1/notify-inquiry',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body    := jsonb_build_object('id', new.id)
  );
  return new;
exception when others then
  return new;  -- never block a customer's request because notification failed
end;
$$;

revoke all on function public.notify_new_inquiry() from public, anon, authenticated;

drop trigger if exists inquiries_notify on public.inquiries;
create trigger inquiries_notify after insert on public.inquiries
  for each row execute function public.notify_new_inquiry();
