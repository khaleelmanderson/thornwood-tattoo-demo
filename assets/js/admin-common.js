// Shared admin-panel helpers: status messages, confirmation, tabs, and
// reordering. Every admin-*.js section file uses these so behavior
// (what a success/error looks like, how destructive actions confirm)
// is consistent across Gallery/Artists/Services/Hours/Inquiries/Settings.

/** Show a success/error/warning message in a section's status box.
 * Every write action in the admin panel ends by calling this — there is
 * no silent failure and no silent success. */
function showStatus(elId, type, message) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.hidden = false;
  el.className = `alert alert-${type}`;
  el.textContent = message;
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function hideStatus(elId) {
  const el = document.getElementById(elId);
  if (el) el.hidden = true;
}

/** Plain-language confirmation before anything destructive. Ported
 * pattern from website-portfolio (native confirm() — no library needed,
 * and it's about as unambiguous as a dialog gets for someone who has
 * never used an admin panel before). */
function confirmDestructive(message) {
  return window.confirm(message);
}

// ---------------------------------------------------------------- tabs
document.addEventListener('DOMContentLoaded', () => {
  const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
  if (!tabs.length) return;

  function activate(tab) {
    tabs.forEach((t) => {
      const selected = t === tab;
      t.setAttribute('aria-selected', String(selected));
      t.tabIndex = selected ? 0 : -1;
      const panel = document.getElementById(t.getAttribute('aria-controls'));
      if (panel) panel.hidden = !selected;
    });
    tab.focus();
  }

  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => activate(tab));
    tab.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') activate(tabs[(i + 1) % tabs.length]);
      else if (e.key === 'ArrowLeft') activate(tabs[(i - 1 + tabs.length) % tabs.length]);
    });
  });
});

/** Move an item up/down within a display_order-sorted list by swapping
 * display_order with its neighbor and persisting both rows. Returns
 * true if a move happened (false at either end of the list). */
async function reorderItem(table, sortedItems, index, direction) {
  const swapWith = index + direction;
  if (swapWith < 0 || swapWith >= sortedItems.length) return false;
  const client = requireSupabaseClient();
  const a = sortedItems[index];
  const b = sortedItems[swapWith];
  const aOrder = a.display_order;
  const bOrder = b.display_order;
  const { error: err1 } = await client.from(table).update({ display_order: bOrder }).eq('id', a.id);
  if (err1) throw err1;
  const { error: err2 } = await client.from(table).update({ display_order: aOrder }).eq('id', b.id);
  if (err2) throw err2;
  return true;
}

/** A "Move up" / "Move down" button pair, wired to reorderItem and a
 * re-render callback. Disabled correctly at the ends of the list. */
function buildReorderControls(table, sortedItems, index, statusElId, onReordered) {
  const up = el('button', {
    type: 'button',
    className: 'btn btn-outline',
    'aria-label': 'Move up',
    text: '↑',
    disabled: index === 0 ? 'true' : null,
    onclick: async () => {
      try {
        const moved = await reorderItem(table, sortedItems, index, -1);
        if (moved) onReordered();
      } catch (err) {
        showStatus(statusElId, 'error', err.message || 'Could not reorder. Please try again.');
      }
    },
  });
  const down = el('button', {
    type: 'button',
    className: 'btn btn-outline',
    'aria-label': 'Move down',
    text: '↓',
    disabled: index === sortedItems.length - 1 ? 'true' : null,
    onclick: async () => {
      try {
        const moved = await reorderItem(table, sortedItems, index, 1);
        if (moved) onReordered();
      } catch (err) {
        showStatus(statusElId, 'error', err.message || 'Could not reorder. Please try again.');
      }
    },
  });
  return el('div', { style: 'display:flex;gap:0.4rem' }, [up, down]);
}

/** Turn "My Great Piece" into "my-great-piece" — used for artist slugs. */
function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
