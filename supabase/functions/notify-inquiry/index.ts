import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// notify-inquiry: emails the studio owner when a new booking inquiry is inserted.
//
// Trust model: this endpoint accepts only an inquiry id. It never trusts the
// request body for content. It atomically "claims" the row (sets notified_at)
// only if the row exists, is recent, and has not been notified yet, then sends
// an email built from the database row. Random callers therefore cannot make
// it send arbitrary email, and each inquiry can be emailed at most once.
//
// Secrets (set in the Supabase dashboard under Edge Functions > Secrets):
//   RESEND_API_KEY, FROM_EMAIL, STUDIO_EMAIL
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically.
// Deployed with verify_jwt = false because the caller is a database trigger;
// authorization is the database-state check described above.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_KEY = Deno.env.get("RESEND_API_KEY");
const FROM = Deno.env.get("FROM_EMAIL");
const TO = Deno.env.get("STUDIO_EMAIL");
const MAX_AGE_MS = 10 * 60 * 1000;

function rest(path: string, init: RequestInit = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

const oneLine = (s: unknown, max = 200) =>
  String(s ?? "").replace(/[\r\n]+/g, " ").slice(0, max);

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });

  let id: unknown;
  try {
    ({ id } = await req.json());
  } catch {
    return new Response("bad request", { status: 400 });
  }
  if (typeof id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return new Response("bad request", { status: 400 });
  }
  if (!RESEND_KEY || !FROM || !TO) {
    // Not configured yet: do not claim the row, so nothing is lost.
    return new Response("notifications not configured", { status: 503 });
  }

  // Atomic claim: only one caller can flip notified_at from null, and only for recent rows.
  const cutoff = new Date(Date.now() - MAX_AGE_MS).toISOString();
  const claimRes = await rest(
    `inquiries?id=eq.${id}&notified_at=is.null&created_at=gte.${encodeURIComponent(cutoff)}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ notified_at: new Date().toISOString() }),
    },
  );
  if (!claimRes.ok) return new Response("lookup failed", { status: 502 });
  const rows = await claimRes.json();
  if (!Array.isArray(rows) || rows.length === 0) {
    return new Response("nothing to send", { status: 200 });
  }
  const q = rows[0];

  let artistName = "";
  if (q.artist_id) {
    try {
      const a = await rest(`artists?id=eq.${q.artist_id}&select=name`);
      const arr = a.ok ? await a.json() : [];
      artistName = arr?.[0]?.name ?? "";
    } catch { /* non-critical */ }
  }

  const lines = [
    `New booking request from ${oneLine(q.name, 100)}`,
    "",
    `Email: ${oneLine(q.email)}`,
    `Phone: ${oneLine(q.phone) || "not given"}`,
    artistName ? `Preferred artist: ${oneLine(artistName)}` : "",
    `Placement: ${oneLine(q.placement) || "not given"}`,
    `Size: ${oneLine(q.size_estimate) || "not given"}`,
    "",
    "Message:",
    String(q.message ?? "").slice(0, 4000),
    "",
    q.reference_image_url
      ? "A reference photo was attached. Open the admin panel to view it."
      : "No reference photo attached.",
    "",
    "Reply directly to this email to answer the customer.",
  ].filter((l, i, all) => l !== "" || all[i - 1] !== "");

  const send = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: FROM,
      to: [TO],
      reply_to: q.email,
      subject: `New booking request from ${oneLine(q.name, 60)}`,
      text: lines.join("\n"),
    }),
  });

  if (!send.ok) {
    // Release the claim so a retry is possible, and report failure.
    await rest(`inquiries?id=eq.${id}`, {
      method: "PATCH",
      body: JSON.stringify({ notified_at: null }),
    });
    return new Response("email provider error", { status: 502 });
  }
  return new Response("sent", { status: 200 });
});
