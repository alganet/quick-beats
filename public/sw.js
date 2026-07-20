// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

// Minimal, dependency-free service worker for installability + offline use.
// __APP_VERSION__ is replaced with package.json `version` at build time (see
// stampServiceWorkerVersion in vite.config.js), so each release gets a fresh
// cache name. In dev the placeholder stays, but the SW is only registered in
// production builds, so it never runs uncached here.
//
// The guiding rule, learned the hard way in 1.7.0: a launch must never depend
// on the network or on this worker finishing anything. An installed PWA opened
// from the home screen has no address bar and no obvious reload — a launch that
// waits on a flaky mobile connection is a blank screen with no way out.
const CACHE_VERSION = '__APP_VERSION__';
const SHELL_CACHE = `qb-shell-${CACHE_VERSION}`;
const RUNTIME_CACHE = `qb-runtime-${CACHE_VERSION}`;

// Cap the runtime cache so loading both kits (~49 MB of wavs) plus the model
// weights can't grow it without bound. Oldest entries are evicted first.
const RUNTIME_MAX_ENTRIES = 400;

// Scanning 400 cache keys on every put thrashes the worker thread exactly when
// it is busiest — the kit prefetch storm on first load is dozens of puts back to
// back, and the worker is single-threaded, so that work delays whatever the page
// is waiting on. Amortise it: a burst can overshoot by at most this many entries.
const TRIM_EVERY_N_PUTS = 25;

// Scope-relative shell assets. self.registration.scope is the absolute URL the
// SW controls (e.g. https://host/quick-beats/), so these resolve correctly in
// both dev (/) and prod (/quick-beats/) without hardcoding the base.
// The shell HTML is listed twice on purpose, under both URLs the host serves it
// at: precaching is per-entry and tolerant of failures now, so a host that only
// answers one of the two still yields a usable shell (navigationHandler tries
// both). Two 2 kB fetches is a cheap premium for the document a launch needs.
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

const scoped = (path) => new URL(path, self.registration.scope).href;

// The two URLs the shell document is served at, tried in this order when a
// navigation needs it.
const SHELL_URLS = () => [scoped('index.html'), scoped('./')];

// Membership of SHELL_ASSETS is a fixed question — the scope never changes for
// the life of the worker — so resolve it once instead of rebuilding 8 URL
// objects on every request that reaches the shell branch of the fetch handler.
let shellUrlSet = null;
const isShellUrl = (href) => {
  shellUrlSet ??= new Set(SHELL_ASSETS.map(scoped));
  return shellUrlSet.has(href);
};

// Every read of our own caches ignores Vary, and it is load-bearing. Precache
// entries are stored from a plain fetch inside the worker, but the page requests
// its bundle as a module script — a CORS fetch that sends an `Origin` header the
// precache fetch never had. A host that answers `Vary: Origin` (vite preview) or
// `Vary: Accept-Encoding` (most CDNs) therefore makes the precached JS and CSS
// unmatchable: they sit in the cache, cache.match returns undefined, and an
// offline or slow launch renders a blank page with no script. Everything we
// cache is an immutable same-origin static file, so varying on request headers
// buys nothing and costs the whole offline story.
const MATCH_OPTS = { ignoreVary: true };

// Precache one entry at a time rather than cache.addAll. addAll is atomic: a
// single failed request — one flaky moment on a mobile connection — rejects the
// whole install, Chrome discards the worker, and the next launch races the same
// install all over again. Partial precache degrades gracefully (the misses just
// fall through to the network); an install that never lands does not.
async function precache(cache, paths) {
  const results = await Promise.allSettled(
    paths.map(async (path) => {
      const url = scoped(path);
      // cache: 'reload' bypasses the HTTP cache so a reinstall can't re-store a
      // stale copy of the shell — but only for the unhashed entries that can go
      // stale. Forcing it on the hashed build assets would re-download the whole
      // bundle the page just fetched, over the same slow connection this install
      // has to survive; their names change whenever their contents do, so the
      // HTTP cache can never hand back the wrong bytes.
      const immutable = BUILD_ASSETS.includes(path);
      const response = await fetch(url, immutable ? undefined : { cache: 'reload' });
      if (!response.ok) throw new Error(`${response.status} for ${url}`);
      await cache.put(url, response);
    }),
  );
  const failed = results.filter((r) => r.status === 'rejected');
  if (failed.length) {
    console.warn(`[sw] ${failed.length}/${paths.length} precache entries failed`, failed.map((r) => r.reason));
  }
}

self.addEventListener('install', (event) => {
  // No skipWaiting. A new worker that seizes a running page then purges the old
  // caches in activate pulls assets out from under a document still loading them
  // — the update-path version of the same blank screen. Waiting means activation
  // happens only once every page on the old version is gone, so the purge below
  // is always safe and an update lands cleanly on the next launch.
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => precache(cache, SHELL_ASSETS.concat(BUILD_ASSETS))));
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
      // Safe on a first install (nothing was controlling the page anyway) and
      // safe on an update (no old client survives to be claimed).
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

// Seeded at the threshold so the first runtime put of each worker lifetime
// trims, then every TRIM_EVERY_N_PUTS after that. Starting at 0 would make the
// cap unenforceable: this counter dies with the worker (~30s idle), so a user
// who caches one kit per session — fewer puts than the threshold, every time —
// would never trim at all and the runtime cache would grow without bound. One
// key scan per worker lifetime is the price of the cap actually binding.
let putsSinceTrim = TRIM_EVERY_N_PUTS;

// CacheFirst: serve from cache, else fetch and store. Only caches full (200)
// responses — audio elements issue Range requests that return 206 Partial
// Content, which must never be cached or playback breaks on cache hits.
//
// checkShellFirst is for /assets/, the one path that can already be sitting in
// the shell cache from the precache: without it the build assets get fetched a
// second time into a duplicate runtime copy. Samples, models and wasm are never
// precached, so probing the shell cache for them would be pure overhead on the
// hottest path in the app — dozens of requests during the kit prefetch storm,
// on a worker thread that is already the bottleneck.
async function cacheFirst(request, cacheName, { checkShellFirst = false } = {}) {
  if (checkShellFirst) {
    const shell = await caches.open(SHELL_CACHE);
    const precached = await shell.match(request, MATCH_OPTS);
    if (precached) return precached;
  }

  const cache = await caches.open(cacheName);
  const cached = await cache.match(request, MATCH_OPTS);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.status === 200) {
    cache.put(request, response.clone());
    if (cacheName === RUNTIME_CACHE && ++putsSinceTrim >= TRIM_EVERY_N_PUTS) {
      putsSinceTrim = 0;
      trimCache(RUNTIME_CACHE, RUNTIME_MAX_ENTRIES);
    }
  }
  return response;
}

// Cache-first for navigations: the launch paints from the precached shell with
// no network in the path at all, so a dead, slow, or still-waking connection
// cannot produce a blank screen. The version on screen is the one this worker
// precached, which is the point — its hashed assets are precached alongside it,
// so shell and bundle can never disagree. A newer deploy is picked up by the
// registration update check in registerSW.js and takes effect on the next launch.
async function navigationHandler(request) {
  const cache = await caches.open(SHELL_CACHE);
  for (const url of SHELL_URLS()) {
    const shell = await cache.match(url, MATCH_OPTS);
    if (shell) return shell;
  }

  // No precached shell (install failed, or partially). Fall back to the network.
  try {
    const response = await fetch(request);
    // A redirected response handed back for a navigate request (whose redirect
    // mode is 'manual') fails the navigation outright — another blank screen.
    // Rebuild it as a plain response so the browser accepts it.
    return response.redirected
      ? new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      })
      : response;
  } catch {
    return Response.error();
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
  const isRuntimeAsset = pathname.includes('/samples/') || pathname.includes('/models/') ||
    pathname.endsWith('.wasm') || pathname.includes('/assets/');
  if (isRuntimeAsset) {
    // Only /assets/ overlaps the precache; the rest can skip the shell lookup.
    event.respondWith(cacheFirst(request, RUNTIME_CACHE, { checkShellFirst: pathname.includes('/assets/') }));
  } else if (isShellUrl(url.href)) {
    // The rest of the shell — manifest, icons, logo — was precached but nothing
    // ever served it, so an offline launch still went to the network for its
    // manifest and got nothing. Anything precached is served from the cache.
    event.respondWith(cacheFirst(request, SHELL_CACHE));
  }
});
