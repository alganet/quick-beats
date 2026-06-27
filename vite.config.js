// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { KITS, DEFAULT_KIT_ID } from './src/data/kit.js'

// Single source of truth for the app version: package.json. Injected into the
// app bundle as __APP_VERSION__ (see `define` below) and stamped into the
// service worker at build time (see stampServiceWorkerVersion).
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'))

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

// Stamp the package.json version into the service worker's CACHE_VERSION. The
// SW lives in public/ (copied verbatim, never transformed), so it ships a
// __APP_VERSION__ placeholder that we replace in the emitted dist/sw.js — this
// keeps its cache name bumping with each release without a manual edit.
const stampServiceWorkerVersion = () => {
  let outDir = 'dist'
  return {
    name: 'stamp-sw-version',
    apply: 'build',
    configResolved(config) { outDir = config.build.outDir },
    closeBundle() {
      const swPath = resolve(outDir, 'sw.js')
      if (!existsSync(swPath)) return
      const src = readFileSync(swPath, 'utf-8').replaceAll('__APP_VERSION__', pkg.version)
      writeFileSync(swPath, src)
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react(), prefetchKitSamples(), stampServiceWorkerVersion()],
  base: mode === 'production' ? '/quick-beats/' : '/',
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    include: ['src/**/*.{test,spec}.{js,jsx}'],
  },
}))
