// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { KITS, DEFAULT_KIT_ID } from './src/data/kit.js'

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

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react(), prefetchKitSamples()],
  base: mode === 'production' ? '/quick-beats/' : '/',
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    include: ['src/**/*.{test,spec}.{js,jsx}'],
  },
}))
