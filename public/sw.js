// Basic Service Worker to satisfy PWA install requirements
const CACHE_NAME = 'neon-drone-cache-v1';

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // We don't strictly need to cache anything to trigger the install prompt,
      // but caching the root makes it load instantly offline.
      return cache.addAll(['/', '/index.html', '/favicon.svg']);
    })
  );
  self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => {
      return response || fetch(e.request);
    }).catch(() => {
      return caches.match('/index.html');
    })
  );
});
