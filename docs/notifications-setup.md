# Booking notifications: setup for a new client project

New booking requests email the studio owner automatically. Setup per client takes about 15 minutes.

## How it works
1. A customer submits `book.html`. The row lands in `public.inquiries`.
2. A database trigger (`inquiries_notify`) sends only the new row's id to the `notify-inquiry` Edge Function.
3. The function looks the row up itself, claims it (`notified_at`), and emails the studio through Resend. Each inquiry is emailed at most once, and only for rows created in the last 10 minutes.

Files: `supabase/functions/notify-inquiry/index.ts` and the migrations in `supabase/migrations/`.

## Steps
1. Create the client's Supabase project and run every migration in `supabase/migrations/` in order (edit the project ref in the `notify_new_inquiry_trigger` migration to the client's ref before running it).
2. Create a Resend account for the client (or use yours and a per-client sender). Verify the sending domain, or use Resend's test sender while testing (check Resend's current limits on who a test sender can email).
3. Deploy the function: `supabase functions deploy notify-inquiry --no-verify-jwt` (it is called by a database trigger, not a browser, and authorizes by database state).
4. Set three secrets in the Supabase dashboard under Edge Functions, Secrets (never commit them): `RESEND_API_KEY`, `FROM_EMAIL`, `STUDIO_EMAIL`.
5. Submit a real test inquiry on the live site. The studio email should arrive within about a minute, with Reply-To set to the customer.
6. Delete the test inquiry in the admin panel.

## If nothing arrives
- The function returns 503 until all three secrets exist. Check Edge Function logs.
- The function only emails rows younger than 10 minutes. Old rows are skipped on purpose.
- Check the Resend dashboard for a rejected send. A rejected send releases the claim so it can be retried.
