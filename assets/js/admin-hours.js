// Admin panel — Hours section: always exactly 7 rows (Sunday-Saturday).
// Each day is its own small inline form so there's no "add a new hours
// row" workflow that could create duplicates or leave a day missing —
// every day is always visible, set or not.

const DAY_NAMES_ADMIN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const hoursAdminState = { byDay: {} };

document.addEventListener('admin:ready', () => {
  loadHoursAdmin();
});

async function loadHoursAdmin() {
  const list = document.getElementById('hours-admin-list');
  if (!list) return;
  try {
    const client = requireSupabaseClient();
    const { data, error } = await client.from('hours').select('*');
    if (error) throw error;
    hoursAdminState.byDay = {};
    (data || []).forEach((row) => { hoursAdminState.byDay[row.day_of_week] = row; });
    renderHoursAdminList();
  } catch (err) {
    console.error('Failed to load hours:', err);
    showStatus('hours-list-status', 'error', "We couldn't load your hours. Please refresh the page.");
  }
}

function renderHoursAdminList() {
  const list = document.getElementById('hours-admin-list');
  clearChildren(list);
  for (let day = 0; day < 7; day++) {
    list.appendChild(buildHoursDayRow(day, hoursAdminState.byDay[day] || null));
  }
}

function buildHoursDayRow(day, row) {
  const isClosed = row ? !!row.is_closed : true;
  const closedCheckbox = el('input', { type: 'checkbox', id: `hours-closed-${day}` });
  closedCheckbox.checked = isClosed;

  const openInput = el('input', { type: 'time', id: `hours-open-${day}`, 'aria-label': 'Opening time' });
  openInput.value = row?.open_time ? row.open_time.slice(0, 5) : '';
  const closeInput = el('input', { type: 'time', id: `hours-close-${day}`, 'aria-label': 'Closing time' });
  closeInput.value = row?.close_time ? row.close_time.slice(0, 5) : '';
  const noteInput = el('input', { type: 'text', id: `hours-note-${day}`, placeholder: 'Note (optional), e.g. "By appointment only"' });
  noteInput.value = row?.note || '';

  function syncDisabled() {
    openInput.disabled = closedCheckbox.checked;
    closeInput.disabled = closedCheckbox.checked;
  }
  syncDisabled();
  closedCheckbox.addEventListener('change', syncDisabled);

  const statusId = `hours-status-${day}`;

  const saveBtn = el('button', {
    type: 'button',
    className: 'btn btn-accent',
    text: 'Save',
    onclick: () => saveHoursDay(day, { closedCheckbox, openInput, closeInput, noteInput }, statusId),
  });

  return el('div', { className: 'admin-row admin-row-hours' }, [
    el('div', { className: 'admin-row-body' }, [
      el('strong', { text: DAY_NAMES_ADMIN[day] }),
      el('label', { className: 'toggle-field', style: 'margin:0.5rem 0' }, [closedCheckbox, ' Closed this day']),
      el('div', { style: 'display:flex;gap:0.75rem;flex-wrap:wrap;align-items:center' }, [
        el('label', { className: 'visually-hidden', for: `hours-open-${day}`, text: 'Opening time' }),
        openInput,
        el('span', { 'aria-hidden': 'true', text: 'to' }),
        closeInput,
      ]),
      noteInput,
      el('div', { id: statusId, className: 'alert', hidden: 'true', role: 'status' }),
    ]),
    el('div', { className: 'admin-row-actions' }, [saveBtn]),
  ]);
}

async function saveHoursDay(day, fields, statusId) {
  hideStatus(statusId);
  try {
    await requireAuthenticated();
  } catch (err) {
    showStatus(statusId, 'error', err.message);
    return;
  }

  const isClosed = fields.closedCheckbox.checked;
  if (!isClosed && (!fields.openInput.value || !fields.closeInput.value)) {
    showStatus(statusId, 'error', 'Please set both an opening and closing time, or mark the day closed.');
    return;
  }

  const payload = {
    day_of_week: day,
    is_closed: isClosed,
    open_time: isClosed ? null : fields.openInput.value,
    close_time: isClosed ? null : fields.closeInput.value,
    note: fields.noteInput.value.trim() || null,
  };

  try {
    const client = requireSupabaseClient();
    // upsert on day_of_week (unique per 0001_schema.sql) instead of
    // insert-vs-update branching — one call whether the day was ever
    // saved before or not, no need to track/carry the row's id.
    const { error } = await client.from('hours').upsert(payload, { onConflict: 'day_of_week' });
    if (error) throw error;
    // Update local state in place rather than reloading the whole list:
    // a full reload would tear down and rebuild every row immediately,
    // wiping this exact success message before anyone could see it.
    hoursAdminState.byDay[day] = { ...hoursAdminState.byDay[day], ...payload };
    showStatus(statusId, 'success', 'Saved.');
  } catch (err) {
    console.error('Failed to save hours:', err);
    showStatus(statusId, 'error', err.message || 'Could not save. Please try again.');
  }
}
