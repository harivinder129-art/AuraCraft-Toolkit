const CACHE_NAME = 'pictopdf-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './styles.css?v=68',
  './app.js?v=72',
  './manifest.json',
  './favicon.svg',
  './icon-192.png',
  './icon-512.png',
  './lucide.min.js',
  './libheif-bundle.js?v=60',
  './heic-to.js?v=60',
  './jspdf.umd.min.js',
  './pdf.min.js',
  './jszip.min.js'
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
      return cachedResponse || fetch(event.request);
    }).catch(() => fetch(event.request))
  );
});
