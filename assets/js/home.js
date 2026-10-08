// index.html page controller.
document.addEventListener('DOMContentLoaded', () => {
  // loadSiteConfig() and the page's data queries are independent — run
  // them in parallel instead of waiting on config before starting data
  // fetches that don't need it.
  loadSiteConfig();
  loadFeaturedGallery();
  loadArtistsPreview();
  loadServices();
  loadHours();
});

// Stale-while-revalidate cache keys for the home page's read-mostly public
// content. Never used for inquiries or anything admin-only.
const FEATURED_GALLERY_CACHE_KEY = 'home_featured_gallery_cache_v1';
const ARTISTS_PREVIEW_CACHE_KEY = 'home_artists_preview_cache_v1';
const SERVICES_CACHE_KEY = 'home_services_cache_v1';
const HOURS_CACHE_KEY = 'home_hours_cache_v1';

async function loadFeaturedGallery() {
  const grid = document.getElementById('featured-gallery');
  const status = document.getElementById('featured-gallery-status');
  if (!grid) return;
  const cached = cacheRead(FEATURED_GALLERY_CACHE_KEY);
  if (cached && cached.length) {
    clearChildren(grid);
    cached.forEach((item) => grid.appendChild(buildGalleryTile(item)));
  } else {
    renderSkeletonCards(grid, 4);
  }
  try {
    const client = requireSupabaseClient();
    const { data, error } = await client
      .from('gallery')
      .select('*')
      .eq('is_featured', true)
      .order('display_order', { ascending: true })
      .limit(8);
    if (error) throw error;
    clearChildren(grid);
    if (!data || !data.length) {
      grid.appendChild(el('p', { className: 'empty-note', text: 'Featured work is coming soon — check back shortly.' }));
      cacheWrite(FEATURED_GALLERY_CACHE_KEY, []);
      return;
    }
    data.forEach((item) => grid.appendChild(buildGalleryTile(item)));
    cacheWrite(FEATURED_GALLERY_CACHE_KEY, data);
  } catch (err) {
    console.error('Failed to load featured gallery:', err);
    if (!cached && status) {
      status.hidden = false;
      status.className = 'alert alert-error';
      status.textContent = "We couldn't load the featured gallery right now. Please try again shortly.";
    }
  } finally {
    grid.setAttribute('aria-busy', 'false');
  }
}

async function loadArtistsPreview() {
  const grid = document.getElementById('artists-preview');
  const status = document.getElementById('artists-preview-status');
  if (!grid) return;
  const cached = cacheRead(ARTISTS_PREVIEW_CACHE_KEY);
  if (cached && cached.length) {
    clearChildren(grid);
    cached.forEach((artist) => grid.appendChild(buildArtistCard(artist)));
  } else {
    renderSkeletonCards(grid, 3);
  }
  try {
    const client = requireSupabaseClient();
    const { data, error } = await client
      .from('artists')
      .select('*')
      .order('display_order', { ascending: true })
      .limit(4);
    if (error) throw error;
    clearChildren(grid);
    if (!data || !data.length) {
      grid.appendChild(el('p', { className: 'empty-note', text: 'Artist profiles are coming soon.' }));
      cacheWrite(ARTISTS_PREVIEW_CACHE_KEY, []);
      return;
    }
    data.forEach((artist) => grid.appendChild(buildArtistCard(artist)));
    cacheWrite(ARTISTS_PREVIEW_CACHE_KEY, data);
  } catch (err) {
    console.error('Failed to load artists:', err);
    if (!cached && status) {
      status.hidden = false;
      status.className = 'alert alert-error';
      status.textContent = "We couldn't load the artist list right now. Please try again shortly.";
    }
  } finally {
    grid.setAttribute('aria-busy', 'false');
  }
}

async function loadServices() {
  const list = document.getElementById('services-list');
  const status = document.getElementById('services-status');
  if (!list) return;
  const cached = cacheRead(SERVICES_CACHE_KEY);
  if (cached && cached.length) {
    clearChildren(list);
    cached.forEach((service) => list.appendChild(buildServiceRow(service)));
  } else {
    renderSkeletonCards(list, 3);
  }
  try {
    const client = requireSupabaseClient();
    const { data, error } = await client.from('services').select('*').order('display_order', { ascending: true });
    if (error) throw error;
    clearChildren(list);
    if (!data || !data.length) {
      list.appendChild(el('p', { className: 'empty-note', text: 'Service pricing is coming soon — message us to ask.' }));
      cacheWrite(SERVICES_CACHE_KEY, []);
      return;
    }
    data.forEach((service) => list.appendChild(buildServiceRow(service)));
    cacheWrite(SERVICES_CACHE_KEY, data);
  } catch (err) {
    console.error('Failed to load services:', err);
    if (!cached && status) {
      status.hidden = false;
      status.className = 'alert alert-error';
      status.textContent = "We couldn't load our services list right now. Please try again shortly.";
    }
  } finally {
    list.setAttribute('aria-busy', 'false');
  }
}

async function loadHours() {
  const list = document.getElementById('hours-list');
  const status = document.getElementById('hours-status');
  if (!list) return;
  const cached = cacheRead(HOURS_CACHE_KEY);
  if (cached && cached.length) {
    clearChildren(list);
    cached.forEach((hour) => list.appendChild(buildHoursRow(hour)));
  } else {
    renderSkeletonHours(list, 7);
  }
  try {
    const client = requireSupabaseClient();
    const { data, error } = await client.from('hours').select('*').order('day_of_week', { ascending: true });
    if (error) throw error;
    clearChildren(list);
    if (!data || !data.length) {
      list.appendChild(el('li', { text: 'Hours coming soon — please call ahead.' }));
      cacheWrite(HOURS_CACHE_KEY, []);
      return;
    }
    data.forEach((hour) => list.appendChild(buildHoursRow(hour)));
    cacheWrite(HOURS_CACHE_KEY, data);
  } catch (err) {
    console.error('Failed to load hours:', err);
    if (!cached && status) {
      status.hidden = false;
      status.className = 'alert alert-error';
      status.textContent = "We couldn't load our hours right now. Please try again shortly.";
    }
  } finally {
    list.setAttribute('aria-busy', 'false');
  }
}
