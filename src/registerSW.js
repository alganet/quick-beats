// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

// Register the service worker in production only. Dev/HMR stays uncached to
// avoid stale-asset footguns. The SW is served from BASE_URL (/quick-beats/ in
// prod, / in dev) and scoped there so it can control the whole app on GitHub
// Pages without a Service-Worker-Allowed header (which Pages can't set).

// The worker serves navigations from its precached shell and never calls
// skipWaiting, so a new deploy has to be discovered deliberately: ask the
// browser to re-check sw.js. A newer worker installs in the background, waits,
// and takes over once every page on the old version is closed — i.e. the next
// launch. Throttled, because visibilitychange fires often and each check is a
// network request.
export const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000

// Split out of the module body, and its two environment dependencies made
// injectable, purely so this can be tested: the wiring below is gated on
// import.meta.env.PROD, which the jsdom suite never sets, so everything here
// would otherwise never be evaluated by a test.
//
// `base` and `container` are injected because jsdom cannot supply either — one
// is substituted at compile time, and jsdom has no navigator.serviceWorker at
// all. `document` and `Date.now` deliberately are not: jsdom's document is real
// and its visibilityState is overridable per test, and Vitest's fake timers
// already control Date. Injecting those would test the injection, not the
// visibility gate or the throttle.
//
// Returning the registration promise is a pure addition — nothing in production
// consumes it — but it lets a test await the registration instead of polling.
export function registerServiceWorker({
  base = import.meta.env.BASE_URL,
  container = navigator.serviceWorker,
} = {}) {
  if (!container) return Promise.resolve(null)

  return container.register(`${base}sw.js`, { scope: base }).then((registration) => {
    let lastCheck = Date.now()

    // An installed PWA is one long-lived document — it can go days without a
    // reload, so returning to it is the moment worth re-checking.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') return
      if (Date.now() - lastCheck < UPDATE_CHECK_INTERVAL_MS) return
      lastCheck = Date.now()
      registration.update().catch(() => { })
    })

    return registration
  }).catch(() => null)
}

/* v8 ignore start -- production-only wiring; registerServiceWorker above is what's tested */
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => { registerServiceWorker() })
}
/* v8 ignore stop */
