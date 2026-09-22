// Admin panel — Inquiries inbox: view booking requests, update status,
// delete. Status updates and reads require authentication per the RLS
// policies from Checkpoint 1; delete uses the extra inquiries_admin_delete
// policy (approved) so the owner can clear spam/test submissions.

const STATUS_LABELS = { new: 'New', replied: 'Replied', booked: 'Booked', declined: 'Declined' };
const inquiriesAdminState = { items: [], artistsById: {} };

document.addEventListener('admin:ready', () => {
  loadInquiriesAdmin();
});

async function loadInquiriesAdmin() {
  const list = document.getElementById('inquiries-admin-list');
  if (!list) return;
  try {
    const client = requireSupabaseClient();
    const [inquiriesRes, artistsRes] = await Promise.all([
      client.from('inquiries').select('*').order('created_at', { ascending: false }),
      client.from('artists').select('id, name'),
    ]);
    if (inquiriesRes.error) throw inquiriesRes.error;
    if (artistsRes.error) throw artistsRes.error;
    inquiriesAdminState.items = inquiriesRes.data || [];
    inquiriesAdminState.artistsById = {};
    (artistsRes.data || []).forEach((a) => { inquiriesAdminState.artistsById[a.id] = a.name; });
    renderInquiriesAdminList();
  } catch (err) {
    console.error('Failed to load inquiries:', err);
    showStatus('inquiries-list-status', 'error', "We couldn't load your inquiries. Please refresh the page.");
  }
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  } catch (err) {
    return iso;
  }
}

function renderInquiriesAdminList() {
  const list = document.getElementById('inquiries-admin-list');
  clearChildren(list);
  if (!inquiriesAdminState.items.length) {
    list.appendChild(el('p', { className: 'empty-note', text: 'No booking requests yet.' }));
    return;
  }
  inquiriesAdminState.items.forEach((inquiry) => {
    const hasRefImage = !!inquiry.reference_image_url;
    const refImg = hasRefImage ? el('img', { alt: `Reference image from ${inquiry.name}` }) : null;
    const refLink = refImg ? el('a', { target: '_blank', rel: 'noopener noreferrer' }, [refImg]) : null;
    const refBox = refLink ? el('div', { className: 'admin-row-media' }, [refLink]) : null;
    if (refBox) {
      getInquiryImageUrl(inquiry.reference_image_url).then((url) => {
        if (url) { refLink.href = url; refImg.src = url; } else { refBox.remove(); }
      }).catch(() => refBox.remove());
    }
    const statusId = `inquiry-status-${inquiry.id}`;
    const select = el('select', { 'aria-label': `Status for ${inquiry.name}` },
      Object.entries(STATUS_LABELS).map(([value, label]) => el('option', { value, text: label })));
    select.value = inquiry.status || 'new';
    select.addEventListener('change', () => updateInquiryStatus(inquiry, select.value, statusId));

    const row = el('div', { className: 'admin-row' }, [
      refBox,
      el('div', { className: 'admin-row-body' }, [
        el('strong', { text: inquiry.name }),
        el('p', { className: 'muted', text: `${inquiry.email}${inquiry.phone ? ' · ' + inquiry.phone : ''}` }),
        el('p', { className: 'muted', text: formatDate(inquiry.created_at) }),
        inquiry.artist_id ? el('p', { className: 'muted', text: `For: ${inquiriesAdminState.artistsById[inquiry.artist_id] || 'an artist no longer listed'}` }) : null,
        inquiry.placement || inquiry.size_estimate
          ? el('p', { className: 'muted', text: [inquiry.placement, inquiry.size_estimate].filter(Boolean).join(' · ') })
          : null,
        inquiry.message ? el('p', { text: inquiry.message }) : null,
        el('div', { id: statusId, className: 'alert', hidden: 'true', role: 'status' }),
      ]),
      el('div', { className: 'admin-row-actions' }, [
        select,
        el('button', { type: 'button', className: 'btn btn-danger', text: 'Delete', onclick: () => deleteInquiry(inquiry) }),
      ]),
    ]);
    list.appendChild(row);
  });
}

async function updateInquiryStatus(inquiry, newStatus, statusId) {
  hideStatus(statusId);
  try {
    await requireAuthenticated();
  } catch (err) {
    showStatus(statusId, 'error', err.message);
    return;
  }
  try {
    const client = requireSupabaseClient();
    const { error } = await client.from('inquiries').update({ status: newStatus }).eq('id', inquiry.id);
    if (error) throw error;
    inquiry.status = newStatus;
    showStatus(statusId, 'success', `Marked as ${STATUS_LABELS[newStatus]}.`);
  } catch (err) {
    console.error('Failed to update inquiry status:', err);
    showStatus(statusId, 'error', err.message || 'Could not update status. Please try again.');
  }
}

async function deleteInquiry(inquiry) {
  if (!confirmDestructive(`Delete the booking request from ${inquiry.name}? This cannot be undone.`)) return;
  try {
    await requireAuthenticated();
  } catch (err) {
    showStatus('inquiries-list-status', 'error', err.message);
    return;
  }
  try {
    const client = requireSupabaseClient();
    const { error } = await client.from('inquiries').delete().eq('id', inquiry.id);
    if (error) throw error;
    let cleanupWarning = '';
    if (inquiry.reference_image_url) {
      try {
        await deleteInquiryImage(inquiry.reference_image_url);
      } catch (cleanupErr) {
        console.error('Reference image cleanup failed:', cleanupErr);
        cleanupWarning = ' The attached image could not be removed from storage.';
      }
    }
    showStatus('inquiries-list-status', cleanupWarning ? 'warning' : 'success', `Deleted.${cleanupWarning}`);
    loadInquiriesAdmin();
  } catch (err) {
    console.error('Failed to delete inquiry:', err);
    showStatus('inquiries-list-status', 'error', err.message || 'Delete failed. Please try again.');
  }
}
