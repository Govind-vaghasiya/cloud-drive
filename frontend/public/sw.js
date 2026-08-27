// ==============================================================================
// Cloud Drive Service Worker (PWA Shell Caching & Offline Resilience)
// ==============================================================================

const CACHE_NAME = 'cloud-drive-shell-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
];

// 1. Install event: pre-cache application shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// 2. Activate event: clean up stale previous caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// 3. Fetch event: Network-first for dynamic API routes, cache-first for static assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Bypass service worker for API endpoints, uploads, streaming, onlyoffice, and auth
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/onlyoffice/') ||
    url.pathname.startsWith('/s/') ||
    url.pathname.startsWith('/health')
  ) {
    return;
  }

  // Cache static frontend shell assets with network fallback
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return response;
      });
    }).catch(() => {
      return caches.match('/index.html');
    })
  );
});
