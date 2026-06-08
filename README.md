<!--
SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>

SPDX-License-Identifier: ISC
-->

# Quick Beats

https://alganet.github.io/quick-beats


Quick Beats is a minimalist drum machine designed for rapid sketching of rhythmic patterns.

It focuses on low latency, intuitive sequencing, and zero-friction sharing of musical ideas.

## Architecture

The project is built as a modern single-page web application using:

1. **React** for declarative UI components, with a light state model that leverages hooks for local and shared state.
2. **Vite** as the build tool, providing fast development servers and optimized production bundles.
3. Custom hooks (e.g. `useAudio`, `useAutoScroll`, `useLongPress`, `useSequencerSelection`) to encapsulate reusable logic such as Web Audio initialization, automatic canvas scrolling, long‑press gestures, and selection management.
4. A small utilities directory (`utils/`) containing helpers for grid calculations, hash‑based state serialization, and sequencing geometry.
5. A comprehensive test suite using **Vitest** and **React Testing Library**; most components and hooks have paired `.test.js(x)` files to ensure correct behavior and guard against regressions.
6. Tailwind CSS for styling and a minimal, responsive layout geared toward both desktop and mobile workflows.
7. Static assets and instrument samples served from the `public/` directory; sample libraries are organized under `public/samples`.
8. A **GrooVAE** groove model for the *humanize* feature, run entirely off the main thread in a Web Worker. The forward pass uses a hand-written **AssemblyScript/WASM SIMD** kernel (`assembly/groove.ts` → `src/wasm/groove.wasm`) with a pure-JS fallback; quantized fp16 weights live in `public/models/groovae/`.

## Features

- **Step Sequencer** with adjustable time signatures and pattern lengths.
- **Multi-instrument kits** loaded from SFZ sample sets.
- **Real-time playback** using the Web Audio API, optimized for low latency on modern browsers.
- **Touch and mouse support** with long‑press for secondary actions and drag selection for editing multiple steps.
- **Shareable links** that encode the current pattern and kit in the URL hash, enabling instant collaboration or recall.
- **Auto-scrolling playhead** keeps the active step centered while the pattern plays.
- **Context menus and confirmations** for destructive operations like clearing a pattern.
- **Humanize** that applies model-generated velocity and microtiming, non-destructively, at playback time.
- **Responsive design** that adapts to narrow viewports and mobile touch events.

## Development

Follow these steps to get the project running locally and contribute.

### Requirements

- Node.js and npm or yarn
- A modern browser for testing (Chrome/Firefox/Safari)

### Setup

```bash
# clone the repo
git clone https://github.com/alganet/quick-beats.git
cd quick-beats

# install dependencies
npm install      # or yarn install
```

### Running in development

Start the Vite development server:

```bash
npm run dev
```

Changes to source files trigger hot module replacement.

### Building for production

```bash
npm run build
```

The output will be written to `dist/` and can be deployed to any static host (GitHub Pages is used in the official deployment).

The `prebuild` step regenerates the icon sprite and recompiles the WASM kernel,
so a plain `npm run build` produces a complete bundle.

### Building the WASM kernel

The humanize model's matrix-vector hot path is a SIMD kernel written in
AssemblyScript (`assembly/groove.ts`) and compiled to `src/wasm/groove.wasm`:

```bash
npm run asbuild   # asc assembly/groove.ts --config asconfig.json --target release
```

The compiled `groove.wasm` is committed to the repo (the `.js`/`.d.ts` binding
stubs are generated and gitignored). SIMD is enabled in `asconfig.json`; the app
falls back to a pure-JS implementation when WASM/SIMD is unavailable.

### Testing

Unit and component tests use **Vitest** with React Testing Library. Run them with:

```bash
npm test             # runs all tests once
npm run test:watch   # watch mode while developing
npm run test:coverage
```

### Linting

This project uses ESLint (config in `eslint.config.js`):

```bash
npm run lint
```


