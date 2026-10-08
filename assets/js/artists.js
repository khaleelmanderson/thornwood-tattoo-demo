// artists.html page controller.
document.addEventListener('DOMContentLoaded', () => {
  // loadSiteConfig() and loadArtists() are independent — run them in
  // parallel instead of waiting on config before fetching artists.
  loadSiteConfig();
  loadArtists();
});

async function loadArtists() {
  const grid = document.getElementById('artists-grid');
  const status = document.getElementById('artists-status');
  const loading = document.getElementById('artists-loading');
  if (!grid) return;
  renderSkeletonCards(grid, 3);
  try {
    const client = requireSupabaseClient();
    const { data, error } = await client.from('artists').select('*').order('display_order', { ascending: true });
    if (error) throw error;
    clearChildren(grid);
    if (!data || !data.length) {
      grid.appendChild(el('p', { className: 'empty-note fade-in', text: 'No artist profiles yet — check back soon.' }));
      return;
    }
    data.forEach((artist) => grid.appendChild(buildArtistCard(artist)));
  } catch (err) {
    console.error('Failed to load artists:', err);
    if (status) {
      status.hidden = false;
      status.className = 'alert alert-error';
      status.textContent = "We couldn't load our artists right now. Please refresh the page or try again shortly.";
    }
  } finally {
    if (loading) loading.hidden = true;
    grid.setAttribute('aria-busy', 'false');
  }
}
