// Admin panel — Services section: compose/edit/delete pattern, reorder.
// No images here, so it's the simplest of the CRUD sections.

const servicesAdminState = { items: [], editingId: null };

document.addEventListener('admin:ready', () => {
  loadServicesAdmin();
  wireServiceForm();
});

async function loadServicesAdmin() {
  const list = document.getElementById('services-admin-list');
  if (!list) return;
  try {
    const client = requireSupabaseClient();
    const { data, error } = await client.from('services').select('*').order('display_order', { ascending: true });
    if (error) throw error;
    servicesAdminState.items = data || [];
    renderServicesAdminList();
  } catch (err) {
    console.error('Failed to load services:', err);
    showStatus('services-list-status', 'error', "We couldn't load the services list. Please refresh the page.");
  }
}

function renderServicesAdminList() {
  const list = document.getElementById('services-admin-list');
  clearChildren(list);
  if (!servicesAdminState.items.length) {
    list.appendChild(el('p', { className: 'empty-note', text: 'No services yet — add the first one below.' }));
    return;
  }
  servicesAdminState.items.forEach((service, index) => {
    const row = el('div', { className: 'admin-row' }, [
      el('div', { className: 'admin-row-body' }, [
        el('strong', { text: service.title }),
        service.description ? el('p', { className: 'muted', text: service.description }) : null,
        service.price_display ? el('p', { text: service.price_display, style: 'font-weight:700;margin:0' }) : null,
      ]),
      el('div', { className: 'admin-row-actions' }, [
        buildReorderControls('services', servicesAdminState.items, index, 'services-list-status', () => { loadServicesAdmin(); }),
        el('button', { type: 'button', className: 'btn btn-outline', text: 'Edit', onclick: () => startEditService(service) }),
        el('button', { type: 'button', className: 'btn btn-danger', text: 'Delete', onclick: () => deleteService(service) }),
      ]),
    ]);
    list.appendChild(row);
  });
}

function startEditService(service) {
  servicesAdminState.editingId = service.id;
  const form = document.getElementById('service-form');
  form.elements['title'].value = service.title || '';
  form.elements['description'].value = service.description || '';
  form.elements['price_display'].value = service.price_display || '';
  document.getElementById('service-submit-btn').textContent = 'Save changes';
  document.getElementById('service-cancel-btn').hidden = false;
  form.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function resetServiceForm() {
  servicesAdminState.editingId = null;
  const form = document.getElementById('service-form');
  form.reset();
  document.getElementById('service-submit-btn').textContent = 'Add service';
  document.getElementById('service-cancel-btn').hidden = true;
}

function wireServiceForm() {
  const form = document.getElementById('service-form');
  if (!form) return;

  document.getElementById('service-cancel-btn').addEventListener('click', resetServiceForm);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideStatus('service-form-status');

    const title = form.elements['title'].value.trim();
    if (!title) { showStatus('service-form-status', 'error', 'Please enter a service name.'); return; }

    try {
      await requireAuthenticated();
    } catch (err) {
      showStatus('service-form-status', 'error', err.message);
      return;
    }

    const submitBtn = document.getElementById('service-submit-btn');
    const wasEditing = !!servicesAdminState.editingId;
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Saving…'; }

    try {
      const client = requireSupabaseClient();
      const payload = {
        title,
        description: form.elements['description'].value.trim() || null,
        price_display: form.elements['price_display'].value.trim() || null,
      };
      if (!wasEditing) {
        payload.display_order = servicesAdminState.items.reduce((max, i) => Math.max(max, i.display_order || 0), 0) + 1;
      }

      if (wasEditing) {
        const { error } = await client.from('services').update(payload).eq('id', servicesAdminState.editingId);
        if (error) throw error;
      } else {
        const { error } = await client.from('services').insert(payload);
        if (error) throw error;
      }

      showStatus('service-form-status', 'success', wasEditing ? 'Saved.' : 'Added.');
      resetServiceForm();
      loadServicesAdmin();
    } catch (err) {
      console.error('Failed to save service:', err);
      showStatus('service-form-status', 'error', err.message || 'Could not save. Please try again.');
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = wasEditing ? 'Save changes' : 'Add service'; }
    }
  });
}

async function deleteService(service) {
  if (!confirmDestructive(`Delete "${service.title}"? This cannot be undone.`)) return;
  try {
    await requireAuthenticated();
  } catch (err) {
    showStatus('services-list-status', 'error', err.message);
    return;
  }
  try {
    const client = requireSupabaseClient();
    const { error } = await client.from('services').delete().eq('id', service.id);
    if (error) throw error;
    showStatus('services-list-status', 'success', 'Deleted.');
    if (servicesAdminState.editingId === service.id) resetServiceForm();
    loadServicesAdmin();
  } catch (err) {
    console.error('Failed to delete service:', err);
    showStatus('services-list-status', 'error', err.message || 'Delete failed. Please try again.');
  }
}
