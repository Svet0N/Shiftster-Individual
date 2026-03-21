/**
 * Shifster Individual — service-worker.js
 * Cache-First with Network-Update strategy
 */

const CACHE = 'shifster-v1';
const PRECACHE = [
  '/',
  '/index.html',
  '/app.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(async c => {
        // Precache only local static files
        for (const url of PRECACHE) {
          try {
            const response = await fetch(url);
            if (response && response.ok) await c.put(url, response);
          } catch (err) { /* silent fail */ }
        }
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (e.request.url.includes('supabase.co')) return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      const fetchPromise = fetch(e.request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return response;
      }).catch(() => null);

      return cached || fetchPromise.then(r => r || caches.match('/index.html'));
    })
  );
});

// Push notification support
self.addEventListener('push', e => {
  const data = e.data?.json() || { title: 'Shifster Individual', body: 'Ново известие' };
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: './icons/icon-192.png',
      badge: './icons/icon-192.png',
      vibrate: [200, 100, 200],
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.openWindow('./'));
});
