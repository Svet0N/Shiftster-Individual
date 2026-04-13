const CACHE_NAME = 'shifster-v3'; // Вдигаме версията отново
const PRECACHE_URLS = [
  '/',
  '/auth',
  '/app',
  '/manifest.json',
  '/icons/icon.png',
  '/icons/logo-nav.png',
  '/icons/logo.png',
  '/src/style.css',
  '/src/app/script.js'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_URLS))
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    ))
  );
});

self.addEventListener('fetch', e => {
  if (!e.request.url.startsWith(self.location.origin)) return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      const fetchPromise = fetch(e.request).then(response => {
        if (!response || response.status !== 200) return response;
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(e.request, copy));
        return response;
      }).catch(() => null);

      return cached || fetchPromise.then(r => r || (e.request.mode === 'navigate' ? caches.match('/') : null));
    })
  );
});
