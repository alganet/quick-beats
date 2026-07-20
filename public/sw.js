// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

// Minimal, dependency-free service worker for installability + offline use.
// __APP_VERSION__ is replaced with package.json `version` at build time (see
// stampServiceWorkerVersion in vite.config.js), so each release gets a fresh
// cache name. In dev the placeholder stays, but the SW is only registered in
// production builds, so it never runs uncached here.
const CACHE_VERSION = '__APP_VERSION__';
const SHELL_CACHE = `qb-shell-${CACHE_VERSION}`;
const RUNTIME_CACHE = `qb-runtime-${CACHE_VERSION}`;

// Cap the runtime cache so loading both kits (~49 MB of wavs) plus the model
// weights can't grow it without bound. Oldest entries are evicted first.
const RUNTIME_MAX_ENTRIES = 400;

// Scope-relative shell assets. self.registration.scope is the absolute URL the
// SW controls (e.g. https://host/quick-beats/), so these resolve correctly in
// both dev (/) and prod (/quick-beats/) without hardcoding the base.
const SHELL_ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'logo.svg',
  'icon-192.png',
  'icon-512.png',
  'icon-maskable-512.png',
  'apple-touch-icon.png',
];

// The hashed assets/*.js|css of this build, injected by stampServiceWorkerVersion
// in vite.config.js. They must be precached here rather than left to runtime
// caching: the SW registers on window load, after the page has already fetched
// its JS and CSS, so on the visit that installs it those requests are never
// intercepted — and offline-from-the-first-visit renders a blank page. In dev
// the placeholder stays and the list is empty; the SW is only registered in
// production builds.
const BUILD_ASSETS = [/* __BUILD_ASSETS__ */];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) =>
        cache.addAll(SHELL_ASSETS.concat(BUILD_ASSETS).map((p) => new URL(p, self.registration.scope).href)),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== SHELL_CACHE && key !== RUNTIME_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// Trim a cache to a maximum number of entries (FIFO — Cache Storage preserves
// insertion order), evicting the oldest first.
async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  for (const request of keys.slice(0, keys.length - maxEntries)) {
    await cache.delete(request);
  }
}

// CacheFirst: serve from cache, else fetch and store. Only caches full (200)
// responses — audio elements issue Range requests that return 206 Partial
// Content, which must never be cached or playback breaks on cache hits.
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.status === 200) {
    cache.put(request, response.clone());
    if (cacheName === RUNTIME_CACHE) trimCache(RUNTIME_CACHE, RUNTIME_MAX_ENTRIES);
  }
  return response;
}

// Network-first for navigations, falling back to the cached app shell when
// offline. Also satisfies the "responds to navigation requests" half of
// Chrome's installability criteria.
async function navigationHandler(request) {
  try {
    return await fetch(request);
  } catch {
    const cache = await caches.open(SHELL_CACHE);
    const shell = await cache.match(new URL('index.html', self.registration.scope).href);
    return shell || Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin GETs; let analytics, POSTs, etc. hit the network.
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(navigationHandler(request));
    return;
  }

  const { pathname } = url;
  const isAsset = pathname.includes('/samples/') || pathname.includes('/models/') ||
    pathname.endsWith('.wasm') || pathname.includes('/assets/');
  if (isAsset) {
    event.respondWith(cacheFirst(request, RUNTIME_CACHE));
  }
});
