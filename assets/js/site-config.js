// Applies the client's site_config row to the page: CSS custom
// properties for color/font, and text content for copy — so a client's
// entire look and copy changes from the database alone, with zero code
// edits. Included on every public page, right after supabase-client.js.
//
// Bind copy in HTML with data attributes, e.g.:
//   <span data-config-text="business_name"></span>
//   <a data-config-href="phone"></a>          -> becomes a tel: link
//   <a data-config-href="email"></a>          -> becomes a mailto: link
//   <a data-config-href="instagram"></a>      -> becomes an instagram.com link
//   <img data-config-logo alt="">             -> src + alt from logo_url/business_name

const SITE_CONFIG_DEFAULTS = {
  business_name: 'Studio',
  tagline: '',
  about: '',
  primary_color: '#1a1a1a',
  accent_color: '#b3231c',
  font_heading: '',
  font_body: '',
  theme_base: 'light',
};

/** WCAG relative luminance -> pick readable text color for a background. */
function contrastTextColor(hex) {
  if (!hex || typeof hex !== 'string') return '#ffffff';
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!match) return '#ffffff';
  const [r, g, b] = [match[1], match[2], match[3]].map((h) => parseInt(h, 16) / 255);
  const lin = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const luminance = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return luminance > 0.35 ? '#111111' : '#ffffff';
}

function isValidHexColor(value) {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value.trim());
}

/** Loads a Google Font by family name, if one is configured. Falls back
 * silently to the CSS system-font stack already in styles.css otherwise
 * (a client with no font configured shouldn't see a broken/missing
 * font — they see the kit's clean default). */
function loadGoogleFont(familyName) {
  if (!familyName || typeof familyName !== 'string') return;
  const safeName = familyName.trim();
  if (!safeName) return;
  const linkId = `gfont-${safeName.replace(/[^a-z0-9]/gi, '-').toLowerCase()}`;
  if (document.getElementById(linkId)) return;
  const href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(safeName).replace(/%20/g, '+')}:wght@400;600;700&display=swap`;
  const link = document.createElement('link');
  link.id = linkId;
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}

function applyTheme(config) {
  const root = document.documentElement;
  // Per-client brand choice stored in the database, not the visitor's OS
  // setting — a plain attribute the dark token block in styles.css
  // selects on ([data-theme="dark"]), never prefers-color-scheme.
  // Defaults to light if the field is missing (older/unmigrated rows).
  root.setAttribute('data-theme', config.theme_base === 'dark' ? 'dark' : 'light');

  const primary = isValidHexColor(config.primary_color) ? config.primary_color : SITE_CONFIG_DEFAULTS.primary_color;
  const accent = isValidHexColor(config.accent_color) ? config.accent_color : SITE_CONFIG_DEFAULTS.accent_color;
  root.style.setProperty('--color-primary', primary);
  root.style.setProperty('--color-primary-contrast', contrastTextColor(primary));
  root.style.setProperty('--color-accent', accent);
  root.style.setProperty('--color-accent-contrast', contrastTextColor(accent));

  if (config.font_heading) {
    loadGoogleFont(config.font_heading);
    root.style.setProperty('--font-heading', `'${config.font_heading}', var(--font-fallback)`);
  }
  if (config.font_body) {
    loadGoogleFont(config.font_body);
    root.style.setProperty('--font-body', `'${config.font_body}', var(--font-fallback)`);
  }
}

function applyCopy(config) {
  const businessName = config.business_name || SITE_CONFIG_DEFAULTS.business_name;

  document.querySelectorAll('[data-config-text]').forEach((node) => {
    const field = node.getAttribute('data-config-text');
    const value = config[field];
    if (value) node.textContent = value;
  });

  document.querySelectorAll('[data-config-href]').forEach((node) => {
    const field = node.getAttribute('data-config-href');
    const value = config[field];
    if (!value) {
      node.hidden = true;
      return;
    }
    if (field === 'phone') {
      node.href = `tel:${value.replace(/[^\d+]/g, '')}`;
      if (!node.textContent.trim()) node.textContent = value;
    } else if (field === 'email') {
      const safeEmail = sanitizeEmail(value);
      if (!safeEmail) { node.hidden = true; return; }
      node.href = `mailto:${safeEmail}`;
      if (!node.textContent.trim()) node.textContent = safeEmail;
    } else if (field === 'instagram') {
      const handle = value.replace(/^@/, '').trim();
      if (!handle) { node.hidden = true; return; }
      node.href = `https://instagram.com/${encodeURIComponent(handle)}`;
      if (!node.textContent.trim()) node.textContent = `@${handle}`;
    } else {
      const safeUrl = sanitizeUrl(value);
      if (safeUrl) node.href = safeUrl;
    }
  });

  document.querySelectorAll('[data-config-logo]').forEach((node) => {
    const safeUrl = sanitizeUrl(config.logo_url);
    if (safeUrl) {
      node.src = safeUrl;
      node.alt = node.alt || `${businessName} logo`;
    } else {
      node.hidden = true;
    }
  });

  if (config.business_name) {
    document.title = document.title.includes('|')
      ? document.title.replace(/^.*\|/, `${config.business_name} |`).trim()
      : config.business_name;
  }
}

function sanitizeEmail(value) {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? trimmed : null;
}

const SITE_CONFIG_CACHE_KEY = 'site_config_cache_v1';

/** Fetch site_config (single row) and apply it. A cached copy from the
 * last successful load (if any) is applied immediately so repeat
 * visits never show the generic defaults while the network request is
 * in flight — see the inline pre-paint script in each page's <head>,
 * which applies the same cache synchronously before first paint.
 * Supabase remains the source of truth: a successful fetch always
 * re-applies and re-caches. Always resolves — on failure it falls back
 * to the cache if one exists, or the built-in defaults otherwise, so
 * the page still renders with a working (if generic) theme rather than
 * blank/broken, and returns null so callers can show their own
 * "couldn't load" notice for content that truly depends on the network
 * (not just theming). */
async function loadSiteConfig() {
  const cacheKey = namespacedCacheKey(SITE_CONFIG_CACHE_KEY);
  const cached = cacheRead(cacheKey);
  if (cached) {
    applyTheme(cached);
    applyCopy(cached);
  } else {
    applyTheme(SITE_CONFIG_DEFAULTS);
  }
  try {
    const client = requireSupabaseClient();
    const { data, error } = await client.from('site_config').select('*').single();
    if (error) throw error;
    const config = data || {};
    applyTheme(config);
    applyCopy(config);
    cacheWrite(cacheKey, config);
    return config;
  } catch (err) {
    console.error('Unable to load site configuration:', err);
    if (!cached) applyCopy(SITE_CONFIG_DEFAULTS);
    return null;
  }
}
