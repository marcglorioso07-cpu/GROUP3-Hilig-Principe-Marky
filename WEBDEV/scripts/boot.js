// Inject the nav links partial, THEN load marketplace.js so #navLinks exists.
(async () => {
  const mount = document.getElementById('linksMount');
  if (!mount) return;

  try {
    const res = await fetch('partials/nav-links.html', { cache: 'no-store' });
    mount.innerHTML = await res.text();
  } catch (e) {
    console.error('Failed to load nav links partial:', e);
  }

  // After injection, load the main app script once
  if (!document.querySelector('script[data-app="marketplace"]')) {
    const s = document.createElement('script');
    s.src = 'scripts/marketplace.js';
    s.defer = true;
    s.dataset.app = 'marketplace';
    document.body.appendChild(s);
  }
})();
