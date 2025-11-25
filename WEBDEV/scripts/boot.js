// scripts/boot.js
(async () => {
  async function inject(selector, urls) {
    const mount = document.querySelector(selector);
    if (!mount) return false;

    for (const url of urls) {
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) continue;
        mount.innerHTML = await res.text();
        return true;
      } catch (_) {}
    }
    return false;
  }

  // Inject Business Form
  await inject('#businessSection', [
    'partials/business/form.html',
    './form.html'
  ]);

  // Load Main App if not already loaded
  if (!document.querySelector('script[data-app="marketplace"]')) {
    const s = document.createElement('script');
    s.src = 'scripts/marketplace.js';
    s.defer = true;
    s.dataset.app = 'marketplace';
    document.body.appendChild(s);
  }
})();