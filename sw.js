const CACHE_NAME = 'pictopdf-v9';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './css/styles.css?v=75',
  './js/app.js?v=78',
  './js/modules/state.js',
  './js/modules/theme.js',
  './manifest.json',
  './assets/favicon.svg',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './lib/lucide.min.js',
  './lib/libheif-bundle.js?v=60',
  './lib/heic-to.js?v=60',
  './lib/jspdf.umd.min.js',
  './lib/pdf.min.js',
  './lib/jszip.min.js',
  './lib/pdf.worker.min.js',
  './lib/heic-worker.js?v=60'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS_TO_CACHE))
      .then(() => self.skipWaiting())
      .catch((err) => console.log('PWA cache prefetch note:', err))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;
      return fetch(event.request).catch(() => {
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});