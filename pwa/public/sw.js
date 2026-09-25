// SafeRoute+ Service Worker
// Cache-first for static assets, network-first for API, cache-first for map tiles

const STATIC_CACHE = 'saferoute-static-v1';
const API_CACHE = 'saferoute-api-v1';
const TILE_CACHE = 'saferoute-tiles-v1';

const CACHE_NAMES = [STATIC_CACHE, API_CACHE, TILE_CACHE];

// Install - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll([
        '/',
        '/index.html',
        '/manifest.json',
        '/favicon.ico'
      ]);
    })
  );
  self.skipWaiting();
});

// Activate - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => !CACHE_NAMES.includes(name))
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch - route requests to appropriate cache strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Map tiles (OSM) - Cache First with long expiry
  if (url.origin === 'https://tile.openstreetmap.org' || url.pathname.includes('/tile/')) {
    event.respondWith(cacheFirst(request, TILE_CACHE));
    return;
  }

  // API calls - Network First with fallback
  if (url.pathname.startsWith('/api/') || 
      url.pathname.startsWith('/routes/') || 
      url.pathname.startsWith('/trips/') || 
      url.pathname.startsWith('/contacts/') || 
      url.pathname.startsWith('/reports/') || 
      url.pathname.startsWith('/users/') ||
      url.pathname.startsWith('/safe-points/')) {
    event.respondWith(networkFirst(request, API_CACHE));
    return;
  }

  // Static assets - Cache First
  event.respondWith(cacheFirst(request, STATIC_CACHE));
});

// Cache First strategy
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    return new Response('Offline', { status: 503 });
  }
}

// Network First strategy
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    return new Response(JSON.stringify({ error: 'Offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Background Sync for offline queue
self.addEventListener('sync', (event) => {
  if (event.tag === 'flush-offline-queue') {
    event.waitUntil(flushOfflineQueue());
  }
});

async function flushOfflineQueue() {
  // This would be implemented with IndexedDB in the main app
  // The SW just triggers the flush
  const clients = await self.clients.matchAll();
  clients.forEach((client) => {
    client.postMessage({ type: 'FLUSH_OFFLINE_QUEUE' });
  });
}

// Periodic Sync for risk table updates
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'update-risk-table') {
    event.waitUntil(updateRiskTable());
  }
});

async function updateRiskTable() {
  try {
    await fetch('/api/risk/update', { method: 'POST' });
  } catch (error) {
    console.error('Risk table update failed:', error);
  }
}