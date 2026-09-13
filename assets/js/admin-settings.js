// Admin panel — Site Settings: the single site_config row. Always an
// UPDATE, never an insert — the row is seeded by the schema migration
// and this form just edits it.

let settingsEditingLogoUrl = null;

document.addEventListener('admin:ready', () => {
  loadSettingsAdmin();
  wireSettingsForm();
});

async function loadSettingsAdmin() {
  const form = document.getElementById('settings-form');
  if (!form) return;
  try {
    const client = requireSupabaseClient();
    const { data, error } = await client.from('site_config').select('*').single();
    if (error) throw error;
    const config = data || {};
    form.elements['business_name'].value = config.business_name || '';
    form.elements['tagline'].value = config.tagline || '';
    form.elements['about'].value = config.about || '';
    form.elements['address'].value = config.address || '';
    form.elements['phone'].value = config.phone || '';
    form.elements['email'].value = config.email || '';
    form.elements['instagram'].value = config.instagram || '';
    form.elements['primary_color'].value = /^#[0-9a-f]{6}$/i.test(config.primary_color || '') ? config.primary_color : '#1a1a1a';
    form.elements['accent_color'].value = /^#[0-9a-f]{6}$/i.test(config.accent_color || '') ? config.accent_color : '#b3231c';
    form.elements['font_heading'].value = config.font_heading || '';
    form.elements['font_body'].value = config.font_body || '';
    settingsEditingLogoUrl = config.logo_url || null;
    const preview = document.getElementById('settings-logo-preview');
    const safeLogo = sanitizeUrl(config.logo_url);
    preview.src = safeLogo || '';
    preview.hidden = !safeLogo;
  } catch (err) {
    console.error('Failed to load site settings:', err);
    showStatus('settings-form-status', 'error', "We couldn't load your site settings. Please refresh the page.");
  }
}

function wireSettingsForm() {
  const form = document.getElementById('settings-form');
  if (!form) return;

  form.elements['logo'].addEventListener('change', () => {
    const file = form.elements['logo'].files[0];
    if (!file) return;
    const err = validateImageFile(file);
    if (err) {
      form.elements['logo'].value = '';
      showStatus('settings-form-status', 'error', err);
      return;
    }
    const preview = document.getElementById('settings-logo-preview');
    preview.src = URL.createObjectURL(file);
    preview.hidden = false;
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideStatus('settings-form-status');

    const businessName = form.elements['business_name'].value.trim();
    if (!businessName) { showStatus('settings-form-status', 'error', 'Please enter a business name.'); return; }

    try {
      await requireAuthenticated();
    } catch (err) {
      showStatus('settings-form-status', 'error', err.message);
      return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Saving…'; }

    try {
      const client = requireSupabaseClient();
      const payload = {
        business_name: businessName,
        tagline: form.elements['tagline'].value.trim() || null,
        about: form.elements['about'].value.trim() || null,
        address: form.elements['address'].value.trim() || null,
        phone: form.elements['phone'].value.trim() || null,
        email: form.elements['email'].value.trim() || null,
        instagram: form.elements['instagram'].value.trim().replace(/^@/, '') || null,
        primary_color: form.elements['primary_color'].value,
        accent_color: form.elements['accent_color'].value,
        font_heading: form.elements['font_heading'].value.trim() || null,
        font_body: form.elements['font_body'].value.trim() || null,
      };

      const file = form.elements['logo'].files[0];
      if (file) payload.logo_url = await uploadMediaFile(file, 'site');

      const { error } = await client.from('site_config').update(payload).eq('id', true);
      if (error) throw error;

      let cleanupWarning = '';
      if (file && settingsEditingLogoUrl) {
        try {
          await deleteMediaFile(settingsEditingLogoUrl);
        } catch (cleanupErr) {
          console.error('Old logo cleanup failed:', cleanupErr);
          cleanupWarning = ' The old logo could not be removed from storage, but everything else saved.';
        }
      }

      showStatus('settings-form-status', cleanupWarning ? 'warning' : 'success', `Saved. Your public site now reflects these changes.${cleanupWarning}`);
      form.elements['logo'].value = '';
      loadSettingsAdmin();
    } catch (err) {
      console.error('Failed to save site settings:', err);
      showStatus('settings-form-status', 'error', err.message || 'Could not save. Please try again.');
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Save settings'; }
    }
  });
}
