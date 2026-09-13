// gallery.html page controller — client-side style-tag + healed-work
// filtering, no page reload, plus an accessible lightbox.

const galleryState = { items: [], activeTags: new Set(), healedOnly: false };

document.addEventListener('DOMContentLoaded', async () => {
  await loadSiteConfig();
  await loadGalleryItems();
  wireHealedToggle();
});

async function loadGalleryItems() {
  const grid = document.getElementById('gallery-grid');
  const status = document.getElementById('gallery-status');
  const loading = document.getElementById('gallery-loading');
  if (!grid) return;
  renderSkeletonCards(grid, 6);
  try {
    const client = requireSupabaseClient();
    const { data, error } = await client.from('gallery').select('*').order('display_order', { ascending: true });
    if (error) throw error;
    galleryState.items = data || [];
    buildTagChips();
    renderGallery();
  } catch (err) {
    console.error('Failed to load gallery:', err);
    if (status) {
      status.hidden = false;
      status.className = 'alert alert-error';
      status.textContent = "We couldn't load the gallery right now. Please refresh the page or try again shortly.";
    }
  } finally {
    if (loading) loading.hidden = true;
    grid.setAttribute('aria-busy', 'false');
  }
}

function buildTagChips() {
  const row = document.getElementById('tag-filters');
  if (!row) return;
  const allTags = new Set();
  galleryState.items.forEach((item) => parseTagArray(item.style_tags).forEach((t) => allTags.add(t)));

  clearChildren(row);
  if (!allTags.size) { row.hidden = true; return; }
  row.hidden = false;

  const allChip = el('button', {
    type: 'button',
    className: 'chip',
    'aria-pressed': String(galleryState.activeTags.size === 0),
    text: 'All styles',
    onclick: () => {
      galleryState.activeTags.clear();
      buildTagChips();
      renderGallery();
    },
  });
  row.appendChild(allChip);

  Array.from(allTags).sort((a, b) => a.localeCompare(b)).forEach((tag) => {
    const pressed = galleryState.activeTags.has(tag);
    row.appendChild(el('button', {
      type: 'button',
      className: 'chip',
      'aria-pressed': String(pressed),
      text: tag,
      onclick: () => {
        if (galleryState.activeTags.has(tag)) galleryState.activeTags.delete(tag);
        else galleryState.activeTags.add(tag);
        buildTagChips();
        renderGallery();
      },
    }));
  });
}

function wireHealedToggle() {
  const checkbox = document.getElementById('healed-toggle');
  if (!checkbox) return;
  checkbox.addEventListener('change', () => {
    galleryState.healedOnly = checkbox.checked;
    renderGallery();
  });
}

function renderGallery() {
  const grid = document.getElementById('gallery-grid');
  if (!grid) return;

  const filtered = galleryState.items.filter((item) => {
    if (galleryState.healedOnly && !item.is_healed) return false;
    if (galleryState.activeTags.size === 0) return true;
    const tags = parseTagArray(item.style_tags);
    return tags.some((t) => galleryState.activeTags.has(t));
  });

  clearChildren(grid);
  if (!filtered.length) {
    grid.appendChild(el('p', { className: 'empty-note', text: 'No pieces match those filters yet — try clearing one.' }));
    return;
  }
  filtered.forEach((item) => grid.appendChild(buildGalleryTile(item, { onOpen: openLightbox })));
}

function openLightbox(item) {
  const dialog = document.getElementById('lightbox');
  if (!dialog) return;
  const img = dialog.querySelector('img');
  const caption = dialog.querySelector('.lightbox-caption');
  const safeUrl = sanitizeUrl(item.image_url);
  if (safeUrl) {
    img.src = safeUrl;
    img.alt = item.caption ? item.caption : 'Tattoo artwork, enlarged';
  }
  clearChildren(caption);
  if (item.caption) caption.appendChild(el('p', { text: item.caption }));
  if (item.is_healed) caption.appendChild(el('span', { className: 'badge badge-open', text: 'Healed' }));
  if (typeof dialog.showModal === 'function') dialog.showModal();
}

document.addEventListener('DOMContentLoaded', () => {
  const dialog = document.getElementById('lightbox');
  if (!dialog) return;
  dialog.querySelector('.lightbox-close')?.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });
});
