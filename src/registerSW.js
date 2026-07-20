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
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    const base = import.meta.env.BASE_URL
    navigator.serviceWorker.register(`${base}sw.js`, { scope: base }).then((registration) => {
      let lastCheck = Date.now()

      // An installed PWA is one long-lived document — it can go days without a
      // reload, so returning to it is the moment worth re-checking.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'visible') return
        if (Date.now() - lastCheck < UPDATE_CHECK_INTERVAL_MS) return
        lastCheck = Date.now()
        registration.update().catch(() => { })
      })
    }).catch(() => { })
  })
}
