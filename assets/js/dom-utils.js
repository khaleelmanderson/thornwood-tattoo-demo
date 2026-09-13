// Shared DOM/security helpers.
//
// Ported from website-portfolio's admin.js patterns (escapeHtml/escapeAttr,
// sanitizeImageUrl, getStorageImagePath), plus an `el()` builder used
// everywhere user-supplied text (names, captions, bios, messages) needs
// to land in the page. `el()` sets text via `textContent`, never
// `innerHTML`, so there is no escaping to get right or wrong.

/** Build a DOM element without ever touching innerHTML for user content.
 * @param {string} tag
 * @param {object} [attrs] - attributes/props. `text` sets textContent.
 *   `className` sets the class. Anything starting with "on" is skipped
 *   (attach listeners separately) except when passed as an actual
 *   function under a matching key, in which case it's added as a
 *   listener (e.g. { onclick: fn }).
 * @param {(Node|string)[]} [children]
 */
function el(tag, attrs, children) {
  const node = document.createElement(tag);
  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) {
      if (value == null) continue;
      if (key === 'text') {
        node.textContent = value;
      } else if (key === 'className') {
        node.className = value;
      } else if (key.startsWith('on') && typeof value === 'function') {
        node.addEventListener(key.slice(2).toLowerCase(), value);
      } else {
        node.setAttribute(key, value);
      }
    }
  }
  for (const child of children || []) {
    if (child == null) continue;
    node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

function clearChildren(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

function escapeHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Only ever allow http(s) URLs — plus safe inline image data URIs —
 * through to href/src attributes. Real uploads always come back as
 * https Supabase Storage URLs; the data:image allowance is for content
 * that was never uploaded to Storage at all (e.g. a placeholder
 * embedded directly in a database column). Restricting to
 * `data:image/...;base64,` specifically still blocks every other
 * data: scheme (data:text/html and friends). */
function sanitizeUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (/^data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,[a-z0-9+/=]+$/i.test(trimmed)) {
    return trimmed;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed.href;
  } catch (err) {
    return null;
  }
}

/** Extract the storage object path from a public Supabase Storage URL,
 * for the given bucket name. Used to clean up storage on delete/replace. */
function getStorageObjectPath(url, bucketName) {
  const safeUrl = sanitizeUrl(url);
  if (!safeUrl) return null;
  try {
    const pathname = new URL(safeUrl).pathname;
    const marker = `/${bucketName}/`;
    const markerIndex = pathname.indexOf(marker);
    if (markerIndex === -1) return null;
    return decodeURIComponent(pathname.slice(markerIndex + marker.length));
  } catch (err) {
    return null;
  }
}

/** Defensively parse a value that should be a string array — Postgres
 * text[] columns come back as real arrays via supabase-js, but this
 * guards against null/unexpected shapes the same way the portfolio's
 * parseTags() guarded against its JSON-string columns. */
function parseTagArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === 'string') {
    return value.split(',').map((t) => t.trim()).filter(Boolean);
  }
  return [];
}
