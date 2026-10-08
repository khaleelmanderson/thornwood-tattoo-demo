// Shared card/row builders — used by home.js, artists.js, artist-detail.js
// and gallery.js so the markup for "an artist card" or "a gallery tile"
// is defined exactly once. Every user-supplied string goes through
// `el()`'s textContent, never innerHTML.

function bookingBadge(status) {
  const known = { open: 'Booking open', waitlist: 'Waitlist', closed: 'Not booking' };
  const label = known[status] || 'Booking open';
  const cls = status === 'closed' ? 'badge-closed' : status === 'waitlist' ? 'badge-waitlist' : 'badge-open';
  return el('span', { className: `badge ${cls}`, text: label });
}

function buildArtistCard(artist) {
  const photo = sanitizeUrl(artist.photo_url);
  const media = el('div', { className: 'card-media' }, [
    photo
      ? el('img', { src: photo, alt: `Portrait of ${artist.name || 'the artist'}`, loading: 'lazy', decoding: 'async' })
      : el('div', { className: 'visually-hidden', text: 'No photo yet' }),
  ]);

  const specialties = parseTagArray(artist.specialties);
  const body = el('div', { className: 'card-body' }, [
    el('h3', { text: artist.name || 'Untitled artist' }),
    bookingBadge(artist.booking_status),
    specialties.length ? el('p', { className: 'muted', text: specialties.join(' · ') }) : null,
    el('a', {
      href: `artist.html?slug=${encodeURIComponent(artist.slug || '')}`,
      className: 'btn btn-outline',
      text: 'View profile',
    }),
  ]);

  return el('article', { className: 'card fade-in' }, [media, body]);
}

function buildGalleryTile(item, { onOpen } = {}) {
  const img = sanitizeUrl(item.image_url);
  const tile = el('figure', { className: 'card fade-in', 'data-style-tags': parseTagArray(item.style_tags).join('|'), 'data-healed': item.is_healed ? '1' : '0' }, [
    el('div', { className: 'card-media' }, [
      img
        ? el('img', {
            src: img,
            alt: item.caption ? item.caption : 'Tattoo artwork',
            loading: 'lazy',
            decoding: 'async',
            onclick: onOpen ? () => onOpen(item) : null,
            style: onOpen ? 'cursor:zoom-in' : null,
          })
        : null,
    ]),
    item.caption || item.is_healed
      ? el('figcaption', { className: 'card-body' }, [
          item.caption ? el('p', { className: 'muted', text: item.caption }) : null,
          item.is_healed ? el('span', { className: 'badge badge-open', text: 'Healed' }) : null,
        ])
      : null,
  ]);
  return tile;
}

/** A skeleton card matches a real card's structure (same aspect-ratio
 * media block, same rough text-line heights) so replacing it with real
 * content doesn't shift the page — this is what keeps Cumulative Layout
 * Shift low once data is actually loading from a network round trip,
 * not just in a no-backend test. */
function buildSkeletonCard() {
  return el('div', { className: 'card skeleton-card', 'aria-hidden': 'true' }, [
    el('div', { className: 'card-media skeleton-block' }),
    el('div', { className: 'card-body' }, [
      el('div', { className: 'skeleton-line medium' }),
      el('div', { className: 'skeleton-line short' }),
      el('div', { className: 'skeleton-line long' }),
    ]),
  ]);
}

function renderSkeletonCards(container, count) {
  if (!container) return;
  clearChildren(container);
  for (let i = 0; i < count; i++) container.appendChild(buildSkeletonCard());
}

function buildSkeletonHoursRow() {
  return el('li', { 'aria-hidden': 'true' }, [
    el('span', { className: 'skeleton-line short', style: 'margin:0;width:5rem' }),
    el('span', { className: 'skeleton-line short', style: 'margin:0;width:7rem' }),
  ]);
}

function renderSkeletonHours(container, count) {
  if (!container) return;
  clearChildren(container);
  for (let i = 0; i < count; i++) container.appendChild(buildSkeletonHoursRow());
}

function buildServiceRow(service) {
  return el('div', { className: 'card fade-in' }, [
    el('div', { className: 'card-body' }, [
      el('h3', { text: service.title || 'Service' }),
      service.description ? el('p', { className: 'muted', text: service.description }) : null,
      service.price_display ? el('p', { text: service.price_display, style: 'font-weight:700;margin:0' }) : null,
    ]),
  ]);
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function formatTime(t) {
  if (!t) return '';
  const [h, m] = String(t).split(':');
  const hour = parseInt(h, 10);
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = ((hour + 11) % 12) + 1;
  return `${displayHour}:${m} ${period}`;
}

function buildHoursRow(hour) {
  const dayName = DAY_NAMES[hour.day_of_week] || '';
  const detail = hour.is_closed
    ? (hour.note || 'Closed')
    : (hour.open_time && hour.close_time ? `${formatTime(hour.open_time)} – ${formatTime(hour.close_time)}` : (hour.note || ''));
  return el('li', { className: 'fade-in' }, [
    el('span', { style: 'font-weight:600', text: dayName }),
    el('span', { text: detail }),
  ]);
}
