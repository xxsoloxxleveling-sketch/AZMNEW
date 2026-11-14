// The UI can be opened offline, but attendance can NEVER be marked offline.
// Auth tokens, API responses, student data, PDF and QR images are not cached.
const VERSION = 'azm-examscan-ui-v3';
const STATIC = [
  './', './index.html', './app.js', './api.js', './camera.js',
  './ui.js', './styles.css', './manifest.webmanifest', './manifest.json', './assets/mark.svg',
  './assets/icon-192.png', './assets/icon-512.png',
];
const STATIC_URLS = new Set(STATIC.map(path => new URL(path, self.registration.scope).href));
self.addEventListener('install', event => {
  event.waitUntil(caches.open(VERSION).then(cache => cache.addAll(STATIC)));
  self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('azm-examscan-ui-') && key !== VERSION).map(key => caches.delete(key)))));
  self.clients.claim();
});
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || !STATIC_URLS.has(req.url) || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(caches.match(req).then(cached => cached || fetch(req)));
});
