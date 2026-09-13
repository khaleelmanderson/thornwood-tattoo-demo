// Admin panel — Artists section: compose/edit/delete pattern ported
// from website-portfolio's admin.js, plus reorder and photo cleanup on
// delete/replace.

const artistsAdminState = { items: [], editingId: null, editingPhotoUrl: null, slugTouched: false };

document.addEventListener('admin:ready', () => {
  loadArtistsAdmin();
  wireArtistForm();
});

async function loadArtistsAdmin() {
  const list = document.getElementById('artists-admin-list');
  if (!list) return;
  try {
    const client = requireSupabaseClient();
    const { data, error } = await client.from('artists').select('*').order('display_order', { ascending: true });
    if (error) throw error;
    artistsAdminState.items = data || [];
    renderArtistsAdminList();
  } catch (err) {
    console.error('Failed to load artists:', err);
    showStatus('artists-list-status', 'error', "We couldn't load the artist list. Please refresh the page.");
  }
}

function renderArtistsAdminList() {
  const list = document.getElementById('artists-admin-list');
  clearChildren(list);
  if (!artistsAdminState.items.length) {
    list.appendChild(el('p', { className: 'empty-note', text: 'No artists yet — add the first one below.' }));
    return;
  }
  artistsAdminState.items.forEach((artist, index) => {
    const photo = sanitizeUrl(artist.photo_url);
    const specialties = parseTagArray(artist.specialties);
    const row = el('div', { className: 'admin-row' }, [
      el('div', { className: 'admin-row-media' }, [
        photo ? el('img', { src: photo, alt: `Portrait of ${artist.name}` }) : null,
      ]),
      el('div', { className: 'admin-row-body' }, [
        el('strong', { text: artist.name }),
        el('p', { className: 'muted', text: `/artist.html?slug=${artist.slug}` }),
        specialties.length ? el('p', { className: 'muted', text: specialties.join(', ') }) : null,
        bookingBadge(artist.booking_status),
      ]),
      el('div', { className: 'admin-row-actions' }, [
        buildReorderControls('artists', artistsAdminState.items, index, 'artists-list-status', () => { loadArtistsAdmin(); }),
        el('button', { type: 'button', className: 'btn btn-outline', text: 'Edit', onclick: () => startEditArtist(artist) }),
        el('button', { type: 'button', className: 'btn btn-danger', text: 'Delete', onclick: () => deleteArtist(artist) }),
      ]),
    ]);
    list.appendChild(row);
  });
}

function startEditArtist(artist) {
  artistsAdminState.editingId = artist.id;
  artistsAdminState.editingPhotoUrl = artist.photo_url || null;
  artistsAdminState.slugTouched = true; // don't auto-overwrite an existing slug while editing
  const form = document.getElementById('artist-form');
  form.elements['name'].value = artist.name || '';
  form.elements['slug'].value = artist.slug || '';
  form.elements['bio'].value = artist.bio || '';
  form.elements['specialties'].value = parseTagArray(artist.specialties).join(', ');
  form.elements['instagram_handle'].value = artist.instagram_handle || '';
  form.elements['booking_status'].value = artist.booking_status || 'open';
  form.elements['photo'].value = '';
  const preview = document.getElementById('artist-photo-preview');
  const safePhoto = sanitizeUrl(artist.photo_url);
  preview.src = safePhoto || '';
  preview.hidden = !safePhoto;
  document.getElementById('artist-submit-btn').textContent = 'Save changes';
  document.getElementById('artist-cancel-btn').hidden = false;
  form.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function resetArtistForm() {
  artistsAdminState.editingId = null;
  artistsAdminState.editingPhotoUrl = null;
  artistsAdminState.slugTouched = false;
  const form = document.getElementById('artist-form');
  form.reset();
  document.getElementById('artist-photo-preview').hidden = true;
  document.getElementById('artist-submit-btn').textContent = 'Add artist';
  document.getElementById('artist-cancel-btn').hidden = true;
}

function wireArtistForm() {
  const form = document.getElementById('artist-form');
  if (!form) return;

  form.elements['name'].addEventListener('input', () => {
    if (!artistsAdminState.slugTouched) {
      form.elements['slug'].value = slugify(form.elements['name'].value);
    }
  });
  form.elements['slug'].addEventListener('input', () => { artistsAdminState.slugTouched = true; });

  form.elements['photo'].addEventListener('change', () => {
    const file = form.elements['photo'].files[0];
    if (!file) return;
    const err = validateImageFile(file);
    if (err) {
      form.elements['photo'].value = '';
      showStatus('artist-form-status', 'error', err);
      return;
    }
    const preview = document.getElementById('artist-photo-preview');
    preview.src = URL.createObjectURL(file);
    preview.hidden = false;
  });

  document.getElementById('artist-cancel-btn').addEventListener('click', resetArtistForm);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideStatus('artist-form-status');

    const name = form.elements['name'].value.trim();
    const slug = slugify(form.elements['slug'].value);
    if (!name) { showStatus('artist-form-status', 'error', 'Please enter a name.'); return; }
    if (!slug) { showStatus('artist-form-status', 'error', 'Please enter a page name (used in the artist\'s web address).'); return; }

    try {
      await requireAuthenticated();
    } catch (err) {
      showStatus('artist-form-status', 'error', err.message);
      return;
    }

    const submitBtn = document.getElementById('artist-submit-btn');
    const wasEditing = !!artistsAdminState.editingId;
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Saving…'; }

    try {
      const client = requireSupabaseClient();
      const file = form.elements['photo'].files[0];
      const payload = {
        name,
        slug,
        bio: form.elements['bio'].value.trim() || null,
        specialties: form.elements['specialties'].value.split(',').map((t) => t.trim()).filter(Boolean),
        instagram_handle: form.elements['instagram_handle'].value.trim().replace(/^@/, '') || null,
        booking_status: form.elements['booking_status'].value,
      };
      if (file) payload.photo_url = await uploadMediaFile(file, 'artists');
      if (!wasEditing) {
        payload.display_order = artistsAdminState.items.reduce((max, i) => Math.max(max, i.display_order || 0), 0) + 1;
      }

      let cleanupWarning = '';
      if (wasEditing) {
        const { error } = await client.from('artists').update(payload).eq('id', artistsAdminState.editingId);
        if (error) throw error;
        if (file && artistsAdminState.editingPhotoUrl) {
          try {
            await deleteMediaFile(artistsAdminState.editingPhotoUrl);
          } catch (cleanupErr) {
            console.error('Old artist photo cleanup failed:', cleanupErr);
            cleanupWarning = ' The old photo could not be removed from storage, but everything else saved.';
          }
        }
      } else {
        const { error } = await client.from('artists').insert(payload);
        if (error) throw error;
      }

      showStatus('artist-form-status', cleanupWarning ? 'warning' : 'success', `${wasEditing ? 'Saved' : 'Added'}.${cleanupWarning}`);
      resetArtistForm();
      loadArtistsAdmin();
    } catch (err) {
      console.error('Failed to save artist:', err);
      const message = /duplicate key.*slug/i.test(err.message || '')
        ? 'That page name is already used by another artist. Please choose a different one.'
        : (err.message || 'Could not save. Please try again.');
      showStatus('artist-form-status', 'error', message);
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = wasEditing ? 'Save changes' : 'Add artist'; }
    }
  });
}

async function deleteArtist(artist) {
  if (!confirmDestructive(`Delete ${artist.name}? Their gallery images will stay, just unassigned from this artist. This cannot be undone.`)) return;
  try {
    await requireAuthenticated();
  } catch (err) {
    showStatus('artists-list-status', 'error', err.message);
    return;
  }
  try {
    const client = requireSupabaseClient();
    const { error } = await client.from('artists').delete().eq('id', artist.id);
    if (error) throw error;
    let cleanupWarning = '';
    if (artist.photo_url) {
      try {
        await deleteMediaFile(artist.photo_url);
      } catch (cleanupErr) {
        console.error('Artist photo cleanup failed:', cleanupErr);
        cleanupWarning = ' The photo file could not be removed from storage.';
      }
    }
    showStatus('artists-list-status', cleanupWarning ? 'warning' : 'success', `Deleted.${cleanupWarning}`);
    if (artistsAdminState.editingId === artist.id) resetArtistForm();
    loadArtistsAdmin();
  } catch (err) {
    console.error('Failed to delete artist:', err);
    showStatus('artists-list-status', 'error', err.message || 'Delete failed. Please try again.');
  }
}
