// index.html page controller.
document.addEventListener('DOMContentLoaded', async () => {
  await loadSiteConfig();
  loadFeaturedGallery();
  loadArtistsPreview();
  loadServices();
  loadHours();
});

async function loadFeaturedGallery() {
  const grid = document.getElementById('featured-gallery');
  const status = document.getElementById('featured-gallery-status');
  if (!grid) return;
  renderSkeletonCards(grid, 4);
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
      return;
    }
    data.forEach((item) => grid.appendChild(buildGalleryTile(item)));
  } catch (err) {
    console.error('Failed to load featured gallery:', err);
    if (status) {
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
  renderSkeletonCards(grid, 3);
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
      return;
    }
    data.forEach((artist) => grid.appendChild(buildArtistCard(artist)));
  } catch (err) {
    console.error('Failed to load artists:', err);
    if (status) {
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
  renderSkeletonCards(list, 3);
  try {
    const client = requireSupabaseClient();
    const { data, error } = await client.from('services').select('*').order('display_order', { ascending: true });
    if (error) throw error;
    clearChildren(list);
    if (!data || !data.length) {
      list.appendChild(el('p', { className: 'empty-note', text: 'Service pricing is coming soon — message us to ask.' }));
      return;
    }
    data.forEach((service) => list.appendChild(buildServiceRow(service)));
  } catch (err) {
    console.error('Failed to load services:', err);
    if (status) {
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
  renderSkeletonHours(list, 7);
  try {
    const client = requireSupabaseClient();
    const { data, error } = await client.from('hours').select('*').order('day_of_week', { ascending: true });
    if (error) throw error;
    clearChildren(list);
    if (!data || !data.length) {
      list.appendChild(el('li', { text: 'Hours coming soon — please call ahead.' }));
      return;
    }
    data.forEach((hour) => list.appendChild(buildHoursRow(hour)));
  } catch (err) {
    console.error('Failed to load hours:', err);
    if (status) {
      status.hidden = false;
      status.className = 'alert alert-error';
      status.textContent = "We couldn't load our hours right now. Please try again shortly.";
    }
  } finally {
    list.setAttribute('aria-busy', 'false');
  }
}
