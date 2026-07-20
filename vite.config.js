// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { KITS, DEFAULT_KIT_ID } from './src/data/kit.js'

// Single source of truth for the app version: package.json. Injected into the
// app bundle as __APP_VERSION__ (see `define` below) and stamped into the
// service worker at build time (see stampServiceWorkerVersion).
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'))

// Release channels.
//
//   stable — the GitHub Pages site at /quick-beats/, cut only from a pushed v* tag.
//   beta   — a Cloudflare Pages site at the root of its own origin, rebuilt on
//            every push to main.
//
// They live on separate origins, and that is load-bearing rather than
// incidental. A beta hosted under the stable path would sit *inside* the stable
// service worker's /quick-beats/ scope, and the cache-first navigation handler
// would answer beta navigations with the stable shell — beta would be
// unreachable for anyone with stable cached. Cache Storage is also partitioned
// by origin, not by scope, and the SW's activate step deletes every cache key
// that isn't its own, so two channels sharing an origin would purge each
// other's caches on every deploy. Separate origins remove both by construction.
//
// Every value below defaults to the stable one, so a bare `npm run build` keeps
// producing exactly what it produces today. A channel is opted into, never
// inferred.
const CHANNELS = {
  stable: { base: '/quick-beats/', appName: 'Quick Beats', analytics: true, indexable: true },
  beta: { base: '/', appName: 'Quick Beats Beta', analytics: false, indexable: false },
}

// The Google Analytics property for the stable site, injected by channelHtml
// rather than written into index.html so that whether the tag ships at all is a
// property of the channel — decided in one place — instead of a line of markup
// someone has to remember to strip.
const ANALYTICS_ID = 'G-087KLX3WP7'

// Short commit SHA for the beta version badge. CI hands it over (Actions sets
// GITHUB_SHA); the git call is the local fallback, wrapped because a shallow
// clone or a source tarball with no .git must not fail the build.
const shortCommitSha = () => {
  const fromEnv = process.env.QB_COMMIT_SHA || process.env.GITHUB_SHA
  if (fromEnv) return fromEnv.slice(0, 7)
  try {
    return execFileSync('git', ['rev-parse', '--short=7', 'HEAD'], { encoding: 'utf-8' }).trim()
  } catch {
    return 'unknown'
  }
}

// Inject <link rel="prefetch"> for the default kit's samples into index.html so
// a static host (GitHub Pages — no Link: preload headers available) starts
// downloading them during HTML parse, in parallel with the JS bundle, instead
// of waiting for React to mount and fire the fetch. Sourced from kit.js so it
// stays in sync, and uses the resolved base so it's correct under /quick-beats/.
const prefetchKitSamples = () => {
  let base = '/'
  return {
    name: 'prefetch-kit-samples',
    configResolved(config) { base = config.base },
    transformIndexHtml() {
      const kit = KITS[DEFAULT_KIT_ID]
      if (!kit) return []
      return Object.values(kit.samples).map((path) => ({
        tag: 'link',
        attrs: { rel: 'prefetch', href: base + (path.startsWith('/') ? path.slice(1) : path) },
        injectTo: 'head',
      }))
    },
  }
}

// Stamp the resolved build version into the service worker's CACHE_VERSION. The
// SW lives in public/ (copied verbatim, never transformed), so it ships a
// __APP_VERSION__ placeholder that we replace in the emitted dist/sw.js — this
// keeps its cache name bumping with each release without a manual edit.
//
// The version is passed in rather than read from pkg here because a beta build
// carries a channel suffix, and the cache name has to bump with it: two beta
// pushes of the same package.json version would otherwise share a cache and
// serve each other's stale assets.
const stampServiceWorkerVersion = (version) => {
  let outDir = 'dist'
  let buildAssets = []
  return {
    name: 'stamp-sw-version',
    apply: 'build',
    configResolved(config) { outDir = config.build.outDir },
    // Collect the emitted hashed JS/CSS names here (closeBundle gets no bundle
    // argument) so the SW can precache them — see BUILD_ASSETS in public/sw.js.
    writeBundle(_options, bundle) {
      buildAssets = Object.keys(bundle).filter((file) => /^assets\/.+\.(js|css)$/.test(file))
    },
    closeBundle() {
      const swPath = resolve(outDir, 'sw.js')
      if (!existsSync(swPath)) return
      const src = readFileSync(swPath, 'utf-8')
        .replaceAll('__APP_VERSION__', version)
        .replace('/* __BUILD_ASSETS__ */', buildAssets.map((file) => JSON.stringify(file)).join(', '))
      writeFileSync(swPath, src)
    },
  }
}

// Rebrand the emitted manifest for non-stable channels. public/manifest.webmanifest
// is copied verbatim by Vite (public assets get no transform pipeline), so the
// only place to brand a beta build is the copy already sitting in dist — the
// same trick, in the same lifecycle slot, as stampServiceWorkerVersion above.
//
// This matters because an installed PWA is just an icon on a home screen: with
// identical names, a beta install and a stable install are indistinguishable
// once launched, and bug reports stop being attributable to a channel. Names are
// assigned absolutely, never appended, so re-running over an already-rewritten
// file is a no-op — closeBundle fires once per rebuild under `--watch`.
const stampManifestChannel = (channel) => {
  let outDir = 'dist'
  return {
    name: 'stamp-manifest-channel',
    apply: 'build',
    configResolved(config) { outDir = config.build.outDir },
    closeBundle() {
      if (channel.appName === CHANNELS.stable.appName) return
      const manifestPath = resolve(outDir, 'manifest.webmanifest')
      if (!existsSync(manifestPath)) return
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))
      manifest.name = channel.appName
      manifest.short_name = channel.appName
      writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
    },
  }
}

// Per-channel <head> content: the installed-app title, the indexing directive,
// and the analytics tag.
const channelHtml = (channel) => ({
  name: 'channel-html',
  apply: 'build',
  transformIndexHtml() {
    const tags = []

    // iOS reads this meta in preference to the manifest's short_name, so
    // renaming the manifest alone leaves a beta install labelled "Quick Beats"
    // on an iPhone home screen. Always injected (rather than left static in
    // index.html) so the two names can never drift apart.
    tags.push({
      tag: 'meta',
      attrs: { name: 'apple-mobile-web-app-title', content: channel.appName },
      injectTo: 'head',
    })

    // Beta serves the same content as stable from a public origin: left
    // indexable it competes with the real site in search results, and it
    // changes under a visitor's feet on every push to main.
    if (!channel.indexable) {
      tags.push({
        tag: 'meta',
        attrs: { name: 'robots', content: 'noindex, nofollow' },
        injectTo: 'head',
      })
    }

    // Only stable is measured. Beta ships on every commit and is used by a
    // handful of people who already know the app — counting them as production
    // traffic would quietly skew every number on the stable property. `apply:
    // 'build'` also keeps the tag out of `npm run dev`, which until now sent
    // real hits to production from every local session.
    if (channel.analytics) {
      tags.push({
        tag: 'script',
        attrs: { async: true, src: `https://www.googletagmanager.com/gtag/js?id=${ANALYTICS_ID}` },
        injectTo: 'head',
      })
      tags.push({
        tag: 'script',
        children: [
          'window.dataLayer = window.dataLayer || [];',
          'function gtag() { dataLayer.push(arguments); }',
          "gtag('js', new Date());",
          `gtag('config', '${ANALYTICS_ID}');`,
        ].join('\n'),
        injectTo: 'head',
      })
    }

    return tags
  },
})

// Crawler policy for non-indexable channels. Belt and braces alongside the meta
// tag above: robots.txt asks a crawler not to fetch at all, and the header
// tells one that fetched anyway — via an inbound link, say — not to index.
// _headers is Cloudflare Pages' format and is inert on any other host.
//
// Emitted through Rollup rather than written directly so these participate in
// the normal bundle. The SW's BUILD_ASSETS filter only matches assets/*.{js,css},
// so neither file ends up precached.
const robotsPolicy = (channel) => ({
  name: 'robots-policy',
  apply: 'build',
  generateBundle() {
    if (channel.indexable) return
    this.emitFile({ type: 'asset', fileName: 'robots.txt', source: 'User-agent: *\nDisallow: /\n' })
    this.emitFile({ type: 'asset', fileName: '_headers', source: '/*\n  X-Robots-Tag: noindex, nofollow\n' })
  },
})

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  // Channels exist only for real builds. `vite dev` and vitest deliberately
  // ignore QB_CHANNEL: Setup.test.jsx asserts the version badge equals
  // package.json's version, and a stray exported env var in a contributor's
  // shell must never be able to break `npm test`.
  const channelId = command === 'build' ? (process.env.QB_CHANNEL || 'stable') : 'stable'
  const channel = CHANNELS[channelId]
  if (!channel) {
    throw new Error(`Unknown QB_CHANNEL "${channelId}" (expected one of: ${Object.keys(CHANNELS).join(', ')})`)
  }

  // Beta is cut from whatever is on main, many times per version bump, so a bare
  // package.json version can't identify a build. A semver prerelease with the
  // commit SHA can: it shows in the Setup badge, so a tester can report exactly
  // what they were running, and it becomes the SW's CACHE_VERSION.
  const version = channelId === 'stable' ? pkg.version : `${pkg.version}-beta.${shortCommitSha()}`

  // `mode` still decides dev-vs-prod as before; the channel only refines the
  // production side. QB_BASE exists for path-prefixed preview hosts — the deploy
  // workflows must never set it, since a beta built at the stable base would
  // install over stable.
  const base = mode === 'production' ? (process.env.QB_BASE || channel.base) : '/'

  return {
    plugins: [
      react(),
      prefetchKitSamples(),
      stampServiceWorkerVersion(version),
      stampManifestChannel(channel),
      channelHtml(channel),
      robotsPolicy(channel),
    ],
    base,
    define: { __APP_VERSION__: JSON.stringify(version) },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/test/setup.js',
      include: ['src/**/*.{test,spec}.{js,jsx}'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'html', 'lcov', 'json-summary'],
        // Untested modules must count as 0% rather than vanish from the report —
        // finding what isn't covered is the entire point of the number.
        all: true,
        include: ['src/**/*.{js,jsx}'],
        exclude: [
          'src/**/*.{test,spec}.{js,jsx}',
          'src/test/**',   // setup + the service worker harness
          'src/wasm/**',   // AssemblyScript build output, gitignored
          'src/main.jsx',  // the ReactDOM mount; nothing to assert
        ],
        // public/sw.js is deliberately absent: it lives outside src/, and the
        // suite loads it by evaluating its source (see serviceWorkerHarness.js),
        // which v8 cannot instrument. It is thoroughly covered by src/test/sw.test.js
        // and will always read 0% here — adding public/ to `include` would not
        // measure it, only drag the global number down permanently.
        //
        // Global rather than per-file thresholds: per-file fails on data modules
        // that are mostly literals (src/data/kit.js) and on presentational
        // components, which turns the gate into noise. Numbers are the measured
        // baseline floored to the nearest 5, so this fails on a regression rather
        // than on the day it was added.
        // Measured 2026-07-20: 94.5 lines / 92.9 functions / 82.9 branches /
        // 92.6 statements. Raise these as coverage climbs; never lower one to
        // make a red build green.
        thresholds: {
          lines: 90,
          functions: 90,
          branches: 80,
          statements: 90,
          autoUpdate: false,
        },
      },
    },
  }
})
