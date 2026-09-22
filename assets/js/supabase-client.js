// Supabase client bootstrap — shared by every public page and the admin
// panel.
//
// SUPABASE_URL / SUPABASE_ANON_KEY are placeholders. `scripts/init-client.js`
// (Checkpoint 4) replaces these two lines with the values from
// `client.config.json` when a client's copy of this kit is stamped out —
// exact string match, so don't reformat this file without updating that
// script's search string too. Never put the service_role key here or
// anywhere in client-side code — only the anon/publishable key.

const SUPABASE_URL = 'https://bhpfrrksglqxmmtvokpb.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_YMwOsq4gUwZX_q4K9U0low_budJsGN3';
const MEDIA_BUCKET = 'media';
const INQUIRY_BUCKET = 'inquiry-uploads'; // private bucket for customer reference photos

const _createClient = (window.supabase && window.supabase.createClient)
  ? window.supabase.createClient
  : null;

let supabaseClient = null;
let supabaseInitError = null;

if (!_createClient) {
  supabaseInitError = 'Supabase library failed to load. Check your connection and reload the page.';
} else if (!SUPABASE_URL || SUPABASE_URL.startsWith('__')) {
  supabaseInitError = 'This site is not connected to a backend yet (client.config.json has not been applied).';
} else {
  try {
    supabaseClient = _createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } catch (err) {
    supabaseInitError = 'Unable to connect to the backend.';
  }
}

/** Throws if the client never initialized, so every call site's existing
 * try/catch handles it as just another failure to show to the user. */
function requireSupabaseClient() {
  if (!supabaseClient) throw new Error(supabaseInitError || 'Backend is unavailable.');
  return supabaseClient;
}

function getMediaPublicUrl(path) {
  const { data } = requireSupabaseClient().storage.from(MEDIA_BUCKET).getPublicUrl(path);
  return sanitizeUrl(data && data.publicUrl);
}
