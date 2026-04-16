/**
 * ATLiens Baseball Service Worker
 * Cache strategy:
 *   - Precache shell on install (HTML, CSS, JS, alien logo, favicon, hero/LCP img)
 *   - Navigation requests: network-first, fall back to cached shell (offline-safe)
 *   - Static assets (CSS/JS/fonts/svg): stale-while-revalidate
 *   - Images: cache-first with size cap (LRU-like trimming)
 *   - Never cache: og.html preview, API-like endpoints
 * Versioning: bump CACHE_VERSION to invalidate old caches.
 */
const CACHE_VERSION = 'v1.5.0';
const SHELL_CACHE   = `atliens-shell-${CACHE_VERSION}`;
const STATIC_CACHE  = `atliens-static-${CACHE_VERSION}`;
const IMAGE_CACHE   = `atliens-img-${CACHE_VERSION}`;
const FONT_CACHE    = `atliens-fonts-${CACHE_VERSION}`;

const SCOPE_PATH = '/atliens-baseball/';

const SHELL_ASSETS = [
  SCOPE_PATH,
  SCOPE_PATH + 'index.html',
  SCOPE_PATH + 'styles.css?v=2',
  SCOPE_PATH + 'site.js',
  SCOPE_PATH + 'assets/favicon.svg',
  SCOPE_PATH + 'assets/alien-logo.svg',
  SCOPE_PATH + 'assets/img/hype-scream-m.webp',
  SCOPE_PATH + 'assets/img/hype-scream.webp',
  SCOPE_PATH + 'manifest.webmanifest',
];

const MAX_IMAGE_ENTRIES = 60;

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then(cache => cache.addAll(SHELL_ASSETS).catch(() => {/* tolerate partial precache */}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    const keep = new Set([SHELL_CACHE, STATIC_CACHE, IMAGE_CACHE, FONT_CACHE]);
    await Promise.all(keys.filter(k => !keep.has(k)).map(k => caches.delete(k)));
    if (self.registration.navigationPreload) {
      try { await self.registration.navigationPreload.enable(); } catch (e) {}
    }
    await self.clients.claim();
  })());
});

// Helpers
const sameOrigin = (url) => new URL(url).origin === self.location.origin;
const isFontCDN  = (url) => /(?:fonts\.googleapis\.com|fonts\.gstatic\.com)/.test(url);
const isImage    = (req) => req.destination === 'image' || /\.(?:png|jpe?g|webp|avif|gif|svg)$/i.test(new URL(req.url).pathname);

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  await Promise.all(keys.slice(0, keys.length - maxEntries).map(k => cache.delete(k)));
}

async function cacheFirstWithUpdate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  const fetchAndCache = fetch(req).then(res => {
    if (res && res.status === 200) cache.put(req, res.clone());
    return res;
  }).catch(() => cached);
  return cached || fetchAndCache;
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  const networkPromise = fetch(req).then(res => {
    if (res && res.status === 200) cache.put(req, res.clone());
    return res;
  }).catch(() => null);
  return cached || (await networkPromise) || new Response('', { status: 504 });
}

async function networkFirstNavigation(event) {
  try {
    const preload = await event.preloadResponse;
    if (preload) return preload;
    const network = await fetch(event.request);
    const cache = await caches.open(SHELL_CACHE);
    cache.put(SCOPE_PATH, network.clone()).catch(() => {});
    return network;
  } catch (err) {
    const cache = await caches.open(SHELL_CACHE);
    const cached = await cache.match(event.request) || await cache.match(SCOPE_PATH) || await cache.match(SCOPE_PATH + 'index.html');
    return cached || new Response('Offline - try again when connected.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Skip og.html preview and sw itself
  if (url.pathname.endsWith('/og.html') || url.pathname.endsWith('/sw.js')) return;

  // HTML navigations: network-first
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(networkFirstNavigation(event));
    return;
  }

  // Google Fonts (cache long)
  if (isFontCDN(url.href)) {
    event.respondWith(cacheFirstWithUpdate(req, FONT_CACHE));
    return;
  }

  // Images (cache-first, trim LRU)
  if (isImage(req) && sameOrigin(url.href)) {
    event.respondWith((async () => {
      const res = await cacheFirstWithUpdate(req, IMAGE_CACHE);
      trimCache(IMAGE_CACHE, MAX_IMAGE_ENTRIES);
      return res;
    })());
    return;
  }

  // CSS/JS/JSON/SVG from same origin: SWR
  if (sameOrigin(url.href)) {
    event.respondWith(staleWhileRevalidate(req, STATIC_CACHE));
    return;
  }
});

// Respond to version ping from the page (for debug)
self.addEventListener('message', event => {
  if (event.data === 'version') {
    event.source?.postMessage({ version: CACHE_VERSION });
  }
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});
