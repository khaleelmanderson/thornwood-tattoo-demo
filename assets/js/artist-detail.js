// artist.html?slug=... page controller.
document.addEventListener('DOMContentLoaded', () => {
  // loadSiteConfig() and loadArtist() are independent — run them in
  // parallel instead of waiting on config before fetching the artist.
  loadSiteConfig();
  loadArtist();
});

async function loadArtist() {
  const root = document.getElementById('artist-detail');
  const loading = document.getElementById('artist-loading');
  const status = document.getElementById('artist-status');
  if (!root) return;

  const slug = new URLSearchParams(window.location.search).get('slug');
  if (!slug) {
    if (loading) loading.hidden = true;
    showNotFound(root, "No artist was specified.");
    return;
  }

  try {
    const client = requireSupabaseClient();
    const { data: artist, error } = await client.from('artists').select('*').eq('slug', slug).maybeSingle();
    if (error) throw error;
    if (!artist) {
      showNotFound(root, "We couldn't find that artist.");
      return;
    }

    document.title = `${artist.name || 'Artist'} | ${document.title.split('|').pop().trim()}`;

    const photo = sanitizeUrl(artist.photo_url);
    const specialties = parseTagArray(artist.specialties);

    clearChildren(root);
    root.appendChild(el('div', { className: 'grid grid-2', style: 'align-items:start' }, [
      el('div', { className: 'card-media', style: 'border-radius:var(--radius);overflow:hidden' }, [
        photo ? el('img', { src: photo, alt: `Portrait of ${artist.name || 'the artist'}`, loading: 'lazy' }) : null,
      ]),
      el('div', {}, [
        el('h1', { text: artist.name || 'Untitled artist' }),
        bookingBadge(artist.booking_status),
        specialties.length ? el('p', { className: 'muted', text: specialties.join(' · ') }) : null,
        artist.bio ? el('p', { text: artist.bio }) : null,
        artist.instagram_handle
          ? el('p', {}, [
              el('a', {
                href: `https://instagram.com/${encodeURIComponent(artist.instagram_handle.replace(/^@/, ''))}`,
                target: '_blank',
                rel: 'noopener noreferrer',
                text: `@${artist.instagram_handle.replace(/^@/, '')} on Instagram`,
              }),
            ])
          : null,
        el('a', { href: `book.html?artist=${encodeURIComponent(artist.slug)}`, className: 'btn btn-accent', text: 'Book with me' }),
      ]),
    ]));

    loadArtistGallery(artist.id);
  } catch (err) {
    console.error('Failed to load artist:', err);
    if (status) {
      status.hidden = false;
      status.className = 'alert alert-error';
      status.textContent = "We couldn't load this artist's page right now. Please try again shortly.";
    }
  } finally {
    if (loading) loading.hidden = true;
    root.setAttribute('aria-busy', 'false');
  }
}

function showNotFound(root, message) {
  clearChildren(root);
  root.appendChild(el('div', { className: 'empty-note' }, [
    el('p', { text: message }),
    el('a', { href: 'artists.html', className: 'btn btn-outline', text: 'Back to all artists' }),
  ]));
}

async function loadArtistGallery(artistId) {
  const grid = document.getElementById('artist-gallery');
  if (!grid) return;
  renderSkeletonCards(grid, 3);
  try {
    const client = requireSupabaseClient();
    const { data, error } = await client
      .from('gallery')
      .select('*')
      .eq('artist_id', artistId)
      .order('display_order', { ascending: true });
    if (error) throw error;
    clearChildren(grid);
    if (!data || !data.length) {
      grid.appendChild(el('p', { className: 'empty-note', text: "This artist's gallery is coming soon." }));
      return;
    }
    data.forEach((item) => grid.appendChild(buildGalleryTile(item)));
  } catch (err) {
    console.error("Failed to load this artist's gallery:", err);
    grid.appendChild(el('p', { className: 'alert alert-error', text: "We couldn't load this artist's gallery right now." }));
  } finally {
    grid.setAttribute('aria-busy', 'false');
  }
}
