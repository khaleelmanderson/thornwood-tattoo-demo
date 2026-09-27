// Admin panel — Site Settings: the single site_config row. Always an
// UPDATE, never an insert — the row is seeded by the schema migration
// and this form just edits it.
//
// Theme picker: 10 curated presets (palette + fonts + a recommended
// light/dark base) sit above the raw color/font inputs, which move
// under a "Custom" disclosure for advanced use — both write to the
// same primary_color/accent_color/font_heading/font_body fields, so
// there's one save path either way. theme_base (the page's overall
// light/dark background) is a separate, independent toggle: picking a
// preset suggests its recommended base but doesn't lock it in, and
// flipping the toggle never touches the preset's colors/fonts. Neither
// control touches this page's own look — admin.html doesn't load
// site-config.js, so [data-theme] is never set here; this form only
// ever previews the choice inside the scoped #theme-preview mockup.

const PALETTE_PRESETS = [
  { id: 'traditional-americana', name: 'Traditional Americana', niche: 'American Traditional', primary: '#16213E', accent: '#D9A441', font_heading: 'Fraunces', font_body: 'Work Sans', recommended_base: 'light' },
  { id: 'bold-red-classic', name: 'Bold Red Classic', niche: 'The expected tattoo-shop look, refined', primary: '#171310', accent: '#C8102E', font_heading: 'Anton', font_body: 'Inter', recommended_base: 'dark' },
  { id: 'blackwork-minimalist', name: 'Blackwork Minimalist', niche: 'Blackwork / negative space', primary: '#0D0D0D', accent: '#E8E4DA', font_heading: 'Cormorant Garamond', font_body: 'Karla', recommended_base: 'dark' },
  { id: 'fine-line-studio', name: 'Fine Line Studio', niche: 'Fine line / single-needle', primary: '#EFE6DC', accent: '#B08968', font_heading: 'EB Garamond', font_body: 'Jost', recommended_base: 'light' },
  { id: 'neo-traditional-bold', name: 'Neo-Traditional Bold', niche: 'Neo-Traditional / saturated color', primary: '#123C4A', accent: '#E8622C', font_heading: 'Poppins', font_body: 'Nunito Sans', recommended_base: 'dark' },
  { id: 'irezumi-indigo', name: 'Irezumi Indigo', niche: 'Japanese / Irezumi', primary: '#16324F', accent: '#B33951', font_heading: 'Cinzel', font_body: 'Noto Sans', recommended_base: 'dark' },
  { id: 'gothic-dark-art', name: 'Gothic Dark Art', niche: 'Gothic / occult / dark art', primary: '#120E14', accent: '#5C3A6E', font_heading: 'UnifrakturMaguntia', font_body: 'EB Garamond', recommended_base: 'dark' },
  { id: 'botanical-ink', name: 'Botanical Ink', niche: 'Nature, floral and animal work', primary: '#22332B', accent: '#C9A66B', font_heading: 'Fraunces', font_body: 'Lato', recommended_base: 'light' },
  { id: 'boutique-minimal', name: 'Boutique Minimal', niche: 'Upscale, appointment-only studios', primary: '#FAF7F2', accent: '#1C1C1C', font_heading: 'Libre Caslon Display', font_body: 'Inter', recommended_base: 'light' },
  { id: 'coastal-ink', name: 'Coastal Ink', niche: 'Beach-town or nautical shops', primary: '#12333D', accent: '#E07A5F', font_heading: 'Quicksand', font_body: 'Nunito Sans', recommended_base: 'light' },
];

let settingsEditingLogoUrl = null;

document.addEventListener('admin:ready', () => {
  buildPalettePresets();
  wireThemeBaseToggle();
  wireCustomThemeInputs();
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

    setThemeBase(config.theme_base === 'dark' ? 'dark' : 'light');
    setSelectedPalette(config.palette_id || null);
    updateThemePreview();
  } catch (err) {
    console.error('Failed to load site settings:', err);
    showStatus('settings-form-status', 'error', "We couldn't load your site settings. Please refresh the page.");
  }
}

// ---------------------------------------------------------------------
// Palette presets
// ---------------------------------------------------------------------

function buildPalettePresets() {
  const grid = document.getElementById('palette-presets');
  if (!grid) return;
  clearChildren(grid);
  PALETTE_PRESETS.forEach((preset) => {
    grid.appendChild(el('button', {
      type: 'button',
      className: 'palette-swatch',
      'data-palette-id': preset.id,
      'aria-pressed': 'false',
      onclick: () => applyPalettePreset(preset),
    }, [
      el('span', { className: 'palette-swatch-colors' }, [
        el('span', { className: 'palette-swatch-dot', style: `background:${preset.primary}` }),
        el('span', { className: 'palette-swatch-dot', style: `background:${preset.accent}` }),
      ]),
      el('span', { className: 'palette-swatch-name', text: preset.name }),
      el('span', { className: 'palette-swatch-niche', text: preset.niche }),
    ]));
  });
}

function applyPalettePreset(preset) {
  const form = document.getElementById('settings-form');
  if (!form) return;
  form.elements['primary_color'].value = preset.primary;
  form.elements['accent_color'].value = preset.accent;
  form.elements['font_heading'].value = preset.font_heading;
  form.elements['font_body'].value = preset.font_body;
  setSelectedPalette(preset.id);
  setThemeBase(preset.recommended_base === 'dark' ? 'dark' : 'light');
  updateThemePreview();
}

function setSelectedPalette(paletteId) {
  const form = document.getElementById('settings-form');
  if (form) form.elements['palette_id'].value = paletteId || '';
  document.querySelectorAll('.palette-swatch').forEach((btn) => {
    btn.setAttribute('aria-pressed', String(btn.getAttribute('data-palette-id') === paletteId));
  });
}

// Manually editing a raw color/font input means the result may no longer
// match the preset that last set it — clear palette_id so it isn't
// misreported as "this preset" after the fact. The preset's own click
// handler sets these same fields but resets palette_id right after, so
// it's unaffected.
function wireCustomThemeInputs() {
  ['primary_color', 'accent_color', 'font_heading', 'font_body'].forEach((name) => {
    const input = document.querySelector(`#settings-form [name="${name}"]`);
    if (!input) return;
    input.addEventListener('input', () => {
      setSelectedPalette(null);
      updateThemePreview();
    });
  });
}

// ---------------------------------------------------------------------
// theme_base toggle
// ---------------------------------------------------------------------

function wireThemeBaseToggle() {
  const toggle = document.getElementById('theme-base-toggle');
  if (!toggle) return;
  toggle.querySelectorAll('.segmented-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      setThemeBase(btn.getAttribute('data-theme-base'));
      updateThemePreview();
    });
  });
}

function setThemeBase(base) {
  const value = base === 'dark' ? 'dark' : 'light';
  const form = document.getElementById('settings-form');
  if (form) form.elements['theme_base'].value = value;
  document.querySelectorAll('#theme-base-toggle .segmented-btn').forEach((btn) => {
    btn.setAttribute('aria-pressed', String(btn.getAttribute('data-theme-base') === value));
  });
}

// ---------------------------------------------------------------------
// Live preview — styled from inline custom properties scoped to this
// one element, never the page's own tokens, so previewing an unsaved
// choice never changes how the rest of the (always-light) admin panel
// looks.
// ---------------------------------------------------------------------

function updateThemePreview() {
  const preview = document.getElementById('theme-preview');
  const form = document.getElementById('settings-form');
  if (!preview || !form) return;

  // Reuse the SAME [data-theme="dark"] neutral token block
  // (styles.css) the real public pages use, scoped to just this
  // element instead of <html> — not a hand-maintained second copy of
  // the bg/text values, which drifted out of sync with the real dark
  // palette and left this preview's body text unreadable against its
  // own dark background.
  preview.setAttribute('data-theme', form.elements['theme_base'].value === 'dark' ? 'dark' : 'light');

  const primary = /^#[0-9a-f]{6}$/i.test(form.elements['primary_color'].value) ? form.elements['primary_color'].value : '#1a1a1a';
  const accent = /^#[0-9a-f]{6}$/i.test(form.elements['accent_color'].value) ? form.elements['accent_color'].value : '#b3231c';
  const fontHeading = form.elements['font_heading'].value.trim();
  const fontBody = form.elements['font_body'].value.trim();

  preview.style.setProperty('--color-primary', primary);
  preview.style.setProperty('--color-primary-contrast', previewContrastColor(primary));
  preview.style.setProperty('--color-accent', accent);
  preview.style.setProperty('--color-accent-contrast', previewContrastColor(accent));
  preview.style.setProperty('--font-heading', fontHeading ? `'${fontHeading}', var(--font-fallback)` : 'var(--font-fallback)');
  preview.style.setProperty('--font-body', fontBody ? `'${fontBody}', var(--font-fallback)` : 'var(--font-fallback)');

  if (fontHeading) previewLoadGoogleFont(fontHeading);
  if (fontBody) previewLoadGoogleFont(fontBody);
}

// Same WCAG-luminance approach as site-config.js's contrastTextColor(),
// duplicated locally since admin.html doesn't load site-config.js.
function previewContrastColor(hex) {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec((hex || '').trim());
  if (!match) return '#ffffff';
  const [r, g, b] = [match[1], match[2], match[3]].map((h) => parseInt(h, 16) / 255);
  const lin = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const luminance = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return luminance > 0.35 ? '#111111' : '#ffffff';
}

// Same approach as site-config.js's loadGoogleFont(), duplicated locally
// for the same reason — only used here to make the preview show the
// actual typeface, never applied to the rest of the admin page.
function previewLoadGoogleFont(familyName) {
  const safeName = (familyName || '').trim();
  if (!safeName) return;
  const linkId = `gfont-preview-${safeName.replace(/[^a-z0-9]/gi, '-').toLowerCase()}`;
  if (document.getElementById(linkId)) return;
  const href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(safeName).replace(/%20/g, '+')}:wght@400;600;700&display=swap`;
  const link = document.createElement('link');
  link.id = linkId;
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}

// ---------------------------------------------------------------------
// Form wiring
// ---------------------------------------------------------------------

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
        theme_base: form.elements['theme_base'].value === 'dark' ? 'dark' : 'light',
        palette_id: form.elements['palette_id'].value || null,
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
