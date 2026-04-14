const CACHE_NAME = 'neon-drone-cache-v2';

self.addEventListener('install', (e) => {
  // Immediately install the new service worker to replace the broken one
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  // Take control of all pages immediately
  e.waitUntil(clients.claim());
});

self.addEventListener('fetch', (e) => {
  // Empty listener. This simply satisfies PWA install criteria.
  // We DO NOT intercept fetch requests as it breaks Vite's dev server and JS module loading.
});
