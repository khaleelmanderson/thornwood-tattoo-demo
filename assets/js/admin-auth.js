// Admin login/session handling, and the auth guard checked before every
// write action — not just to hide UI. Ported from website-portfolio's
// requireAuthenticated() pattern: single Supabase Auth user is the
// studio owner, one login for the whole admin panel.

/** Throws a plain-language error if there's no active session. Every
 * write function in every admin-*.js file calls this FIRST, before
 * touching the database — so even if someone got a stale page open,
 * or a session expired mid-visit, nothing writes without a live login. */
async function requireAuthenticated() {
  try {
    const client = requireSupabaseClient();
    const { data: { session }, error } = await client.auth.getSession();
    if (error) throw error;
    if (!session) throw new Error('You need to be logged in to do that. Please log in and try again.');
  } catch (err) {
    throw new Error(err.message || 'We could not check whether you are logged in. Please try again.');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  wireLoginForm();
  wireLogout();
  checkSessionOnLoad();
});

function showLogin() {
  document.getElementById('login-section').hidden = false;
  document.getElementById('dashboard-section').hidden = true;
}

function showDashboard() {
  document.getElementById('login-section').hidden = true;
  document.getElementById('dashboard-section').hidden = false;
  document.dispatchEvent(new CustomEvent('admin:ready'));
}

async function checkSessionOnLoad() {
  const alertBox = document.getElementById('login-alert');
  try {
    const client = requireSupabaseClient();
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    if (data.session) showDashboard();
    else showLogin();
  } catch (err) {
    if (alertBox) {
      alertBox.hidden = false;
      alertBox.className = 'alert alert-error';
      alertBox.textContent = err.message || 'Unable to check your login status. Please reload the page.';
    }
    showLogin();
  }
}

function wireLoginForm() {
  const form = document.getElementById('login-form');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const alertBox = document.getElementById('login-alert');
    const submitBtn = form.querySelector('button[type="submit"]');
    if (alertBox) alertBox.hidden = true;
    const email = form.elements['email'].value.trim();
    const password = form.elements['password'].value;
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Logging in…'; }
    try {
      const client = requireSupabaseClient();
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      form.reset();
      showDashboard();
    } catch (err) {
      if (alertBox) {
        alertBox.hidden = false;
        alertBox.className = 'alert alert-error';
        alertBox.textContent = err.message || 'That email or password was not recognized. Please try again.';
      }
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Log in'; }
    }
  });
}

function wireLogout() {
  const btn = document.getElementById('logout-btn');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    if (!confirm('Log out now?')) return;
    try {
      const client = requireSupabaseClient();
      const { error } = await client.auth.signOut();
      if (error) throw error;
      showLogin();
    } catch (err) {
      alert(err.message || 'Logout failed. Please try again.');
    }
  });
}
