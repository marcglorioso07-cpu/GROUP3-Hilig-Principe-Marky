// boot.js — Load partials, THEN load the app
(async () => {
  async function inject(selector, url) {
    const mount = document.querySelector(selector);
    if (!mount) return;
    const res = await fetch(url, { cache: 'no-store' });
    mount.innerHTML = await res.text();
  }

  try {
    await inject('#linksMount', 'partials/nav-links.html');             // top tabs
    await inject('#businessSection', 'partials/business/form.html');    // business form
  } catch (err) {
    console.error('Boot failed to load partials:', err);
  }

  // Load main app AFTER partials exist
  if (!document.querySelector('script[data-app="marketplace"]')) {
    const s = document.createElement('script');
    s.src = 'scripts/marketplace.js';
    s.defer = true;
    s.dataset.app = 'marketplace';
    document.body.appendChild(s);
  }
})();

