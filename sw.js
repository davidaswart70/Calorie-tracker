// Always check GitHub Pages for a newer copy of the app's own files, so updates show
// up on the next open instead of waiting for the phone's cache to expire.
// Unchanged files come back as a quick "not modified"; offline falls back to the cache.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(fetch(req, { cache: 'no-cache' }).catch(() => fetch(req)));
});
