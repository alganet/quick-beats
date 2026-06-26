// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

// Register the service worker in production only. Dev/HMR stays uncached to
// avoid stale-asset footguns. The SW is served from BASE_URL (/quick-beats/ in
// prod, / in dev) and scoped there so it can control the whole app on GitHub
// Pages without a Service-Worker-Allowed header (which Pages can't set).
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    const base = import.meta.env.BASE_URL
    navigator.serviceWorker.register(`${base}sw.js`, { scope: base }).catch(() => {})
  })
}
