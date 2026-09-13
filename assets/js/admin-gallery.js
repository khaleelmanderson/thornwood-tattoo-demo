// Admin panel — Gallery section: drag-and-drop bulk upload, tagging,
// reorder, edit, delete. The compose/edit/delete pattern and the
// storage-cleanup-on-delete/replace pattern are ported from
// website-portfolio's admin.js; the drag-and-drop dropzone itself is
// new (the reference only has a plain multi-file <input>, no drop zone).

const galleryAdminState = { items: [], artists: [], editingId: null };

document.addEventListener('admin:ready', () => {
  loadGalleryAdmin();
  wireDropzone();
  wireGalleryEditForm();
});

async function loadGalleryAdmin() {
  const list = document.getElementById('gallery-admin-list');
  if (!list) return;
  try {
    const client = requireSupabaseClient();
    const [galleryRes, artistsRes] = await Promise.all([
      client.from('gallery').select('*').order('display_order', { ascending: true }),
      client.from('artists').select('id, name').order('display_order', { ascending: true }),
    ]);
    if (galleryRes.error) throw galleryRes.error;
    if (artistsRes.error) throw artistsRes.error;
    galleryAdminState.items = galleryRes.data || [];
    galleryAdminState.artists = artistsRes.data || [];
    populateArtistSelect(document.getElementById('gallery-artist-select'), galleryAdminState.artists);
    renderGalleryAdminList();
  } catch (err) {
    console.error('Failed to load gallery:', err);
    showStatus('gallery-list-status', 'error', "We couldn't load the gallery. Please refresh the page.");
  }
}

function populateArtistSelect(select, artists) {
  if (!select) return;
  const current = select.value;
  clearChildren(select);
  select.appendChild(el('option', { value: '', text: 'Unassigned' }));
  artists.forEach((a) => select.appendChild(el('option', { value: a.id, text: a.name })));
  if (current) select.value = current;
}

function artistName(artistId) {
  const found = galleryAdminState.artists.find((a) => a.id === artistId);
  return found ? found.name : 'Unassigned';
}

function renderGalleryAdminList() {
  const list = document.getElementById('gallery-admin-list');
  clearChildren(list);
  if (!galleryAdminState.items.length) {
    list.appendChild(el('p', { className: 'empty-note', text: 'No gallery images yet — drag some in above to get started.' }));
    return;
  }
  galleryAdminState.items.forEach((item, index) => {
    const img = sanitizeUrl(item.image_url);
    const tags = parseTagArray(item.style_tags);
    const row = el('div', { className: 'admin-row' }, [
      el('div', { className: 'admin-row-media' }, [
        img ? el('img', { src: img, alt: item.caption || 'Gallery image' }) : null,
      ]),
      el('div', { className: 'admin-row-body' }, [
        el('strong', { text: item.caption || '(no caption yet)' }),
        el('p', { className: 'muted', text: tags.length ? tags.join(', ') : 'No style tags yet' }),
        el('p', { className: 'muted', text: `Artist: ${artistName(item.artist_id)}` }),
        el('div', { style: 'display:flex;gap:0.4rem;flex-wrap:wrap' }, [
          item.is_healed ? el('span', { className: 'badge badge-open', text: 'Healed' }) : null,
          item.is_featured ? el('span', { className: 'badge badge-waitlist', text: 'Featured' }) : null,
        ]),
      ]),
      el('div', { className: 'admin-row-actions' }, [
        buildReorderControls('gallery', galleryAdminState.items, index, 'gallery-list-status', () => { loadGalleryAdmin(); }),
        el('button', { type: 'button', className: 'btn btn-outline', text: 'Edit', onclick: () => startEditGalleryItem(item) }),
        el('button', { type: 'button', className: 'btn btn-danger', text: 'Delete', onclick: () => deleteGalleryItem(item) }),
      ]),
    ]);
    list.appendChild(row);
  });
}

// ------------------------------------------------------- drag-and-drop upload

function wireDropzone() {
  const zone = document.getElementById('gallery-dropzone');
  const input = document.getElementById('gallery-dropzone-input');
  if (!zone || !input) return;

  zone.addEventListener('click', () => input.click());
  zone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); }
  });

  ['dragenter', 'dragover'].forEach((evt) => {
    zone.addEventListener(evt, (e) => { e.preventDefault(); zone.classList.add('is-dragover'); });
  });
  ['dragleave', 'drop'].forEach((evt) => {
    zone.addEventListener(evt, (e) => { e.preventDefault(); zone.classList.remove('is-dragover'); });
  });
  zone.addEventListener('drop', (e) => {
    const files = e.dataTransfer?.files;
    if (files && files.length) handleGalleryUpload(files);
  });
  input.addEventListener('change', () => {
    if (input.files && input.files.length) handleGalleryUpload(input.files);
    input.value = '';
  });
}

async function handleGalleryUpload(fileList) {
  const files = Array.from(fileList);
  hideStatus('gallery-upload-status');

  try {
    await requireAuthenticated();
  } catch (err) {
    showStatus('gallery-upload-status', 'error', err.message);
    return;
  }

  const badFile = files.find((f) => validateImageFile(f));
  if (badFile) {
    showStatus('gallery-upload-status', 'error', `"${badFile.name}": ${validateImageFile(badFile)}`);
  }
  const validFiles = files.filter((f) => !validateImageFile(f));
  if (!validFiles.length) return;

  const progress = document.getElementById('gallery-upload-progress');
  if (progress) { progress.hidden = false; progress.textContent = `Uploading 0 of ${validFiles.length}…`; }

  const client = requireSupabaseClient();
  let nextOrder = galleryAdminState.items.reduce((max, i) => Math.max(max, i.display_order || 0), 0) + 1;
  let succeeded = 0;
  const failures = [];

  for (let i = 0; i < validFiles.length; i++) {
    const file = validFiles[i];
    if (progress) progress.textContent = `Uploading ${i + 1} of ${validFiles.length}…`;
    try {
      const imageUrl = await uploadMediaFile(file, 'gallery');
      const { error } = await client.from('gallery').insert({
        image_url: imageUrl,
        display_order: nextOrder++,
      });
      if (error) throw error;
      succeeded++;
    } catch (err) {
      console.error(`Failed to upload "${file.name}":`, err);
      failures.push(`${file.name}: ${err.message || 'upload failed'}`);
    }
  }

  if (progress) progress.hidden = true;

  if (succeeded && !failures.length) {
    showStatus('gallery-upload-status', 'success', `Added ${succeeded} image${succeeded === 1 ? '' : 's'}. Click Edit on each to add a caption or tags.`);
  } else if (succeeded && failures.length) {
    showStatus('gallery-upload-status', 'warning', `Added ${succeeded} image${succeeded === 1 ? '' : 's'}, but ${failures.length} failed: ${failures.join('; ')}`);
  } else {
    showStatus('gallery-upload-status', 'error', `Nothing uploaded. ${failures.join('; ')}`);
  }
  loadGalleryAdmin();
}

// ------------------------------------------------------- edit / delete

function startEditGalleryItem(item) {
  galleryAdminState.editingId = item.id;
  const form = document.getElementById('gallery-edit-form');
  form.hidden = false;
  form.elements['caption'].value = item.caption || '';
  form.elements['style_tags'].value = parseTagArray(item.style_tags).join(', ');
  form.elements['is_healed'].checked = !!item.is_healed;
  form.elements['is_featured'].checked = !!item.is_featured;
  form.elements['artist_id'].value = item.artist_id || '';
  document.getElementById('gallery-edit-preview').src = sanitizeUrl(item.image_url) || '';
  document.getElementById('gallery-edit-preview').hidden = !sanitizeUrl(item.image_url);
  form.elements['replacement_image'].value = '';
  form.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function cancelEditGalleryItem() {
  galleryAdminState.editingId = null;
  const form = document.getElementById('gallery-edit-form');
  form.hidden = true;
  form.reset();
}

function wireGalleryEditForm() {
  const form = document.getElementById('gallery-edit-form');
  if (!form) return;

  form.elements['replacement_image'].addEventListener('change', () => {
    const file = form.elements['replacement_image'].files[0];
    if (!file) return;
    const err = validateImageFile(file);
    if (err) {
      form.elements['replacement_image'].value = '';
      showStatus('gallery-edit-status', 'error', err);
      return;
    }
    const preview = document.getElementById('gallery-edit-preview');
    preview.src = URL.createObjectURL(file);
    preview.hidden = false;
  });

  document.getElementById('gallery-edit-cancel').addEventListener('click', cancelEditGalleryItem);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideStatus('gallery-edit-status');
    const item = galleryAdminState.items.find((i) => i.id === galleryAdminState.editingId);
    if (!item) return;

    try {
      await requireAuthenticated();
    } catch (err) {
      showStatus('gallery-edit-status', 'error', err.message);
      return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Saving…'; }

    try {
      const client = requireSupabaseClient();
      const payload = {
        caption: form.elements['caption'].value.trim() || null,
        style_tags: form.elements['style_tags'].value.split(',').map((t) => t.trim()).filter(Boolean),
        is_healed: form.elements['is_healed'].checked,
        is_featured: form.elements['is_featured'].checked,
        artist_id: form.elements['artist_id'].value || null,
      };

      const newFile = form.elements['replacement_image'].files[0];
      let cleanupWarning = '';
      if (newFile) {
        payload.image_url = await uploadMediaFile(newFile, 'gallery');
      }

      const { error } = await client.from('gallery').update(payload).eq('id', item.id);
      if (error) throw error;

      if (newFile && item.image_url) {
        try {
          await deleteMediaFile(item.image_url);
        } catch (cleanupErr) {
          console.error('Old gallery image cleanup failed:', cleanupErr);
          cleanupWarning = ' The old image could not be removed from storage, but everything else saved.';
        }
      }

      showStatus('gallery-edit-status', cleanupWarning ? 'warning' : 'success', `Saved.${cleanupWarning}`);
      cancelEditGalleryItem();
      loadGalleryAdmin();
    } catch (err) {
      console.error('Failed to save gallery image:', err);
      showStatus('gallery-edit-status', 'error', err.message || 'Could not save changes. Please try again.');
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Save changes'; }
    }
  });
}

async function deleteGalleryItem(item) {
  if (!confirmDestructive('Delete this image? This cannot be undone.')) return;
  try {
    await requireAuthenticated();
  } catch (err) {
    showStatus('gallery-list-status', 'error', err.message);
    return;
  }
  try {
    const client = requireSupabaseClient();
    const { error } = await client.from('gallery').delete().eq('id', item.id);
    if (error) throw error;
    let cleanupWarning = '';
    try {
      await deleteMediaFile(item.image_url);
    } catch (cleanupErr) {
      console.error('Gallery image cleanup failed:', cleanupErr);
      cleanupWarning = ' The image file could not be removed from storage.';
    }
    showStatus('gallery-list-status', cleanupWarning ? 'warning' : 'success', `Deleted.${cleanupWarning}`);
    loadGalleryAdmin();
  } catch (err) {
    console.error('Failed to delete gallery image:', err);
    showStatus('gallery-list-status', 'error', err.message || 'Delete failed. Please try again.');
  }
}
