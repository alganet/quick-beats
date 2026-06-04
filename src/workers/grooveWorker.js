// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

// Runs the GrooVAE humanization off the main thread so the UI and audio
// scheduling never stall. Weights are fetched + dequantized inside the worker
// (once) and wrapped in a compute backend: a WASM SIMD matmul where supported,
// else pure JS. Each message computes a performance layer for the given grid,
// streaming one partial per window so the grid fills in as bars finish.

import { loadWeights } from '../utils/grooveWeights';
import { computePerfLayer } from '../utils/grooveConvert';
import { jsBackend } from '../utils/grooveModel';
import { createWasmBackend } from '../utils/grooveWasm';
import wasmUrl from '../wasm/groove.wasm?url';

// Resolves to the compute backend, building it (load weights + try WASM) once.
let backendPromise = null;

const buildBackend = (onProgress) => {
    if (backendPromise) return backendPromise;
    const p = (async () => {
        const weights = await loadWeights(undefined, onProgress);
        let wasm;
        try {
            const bytes = await (await fetch(wasmUrl)).arrayBuffer();
            wasm = createWasmBackend(weights, bytes);
        } catch {
            wasm = null; // wasm fetch/instantiate failed -> JS backend below
        }
        return wasm ?? jsBackend(weights); // each backend carries its own `.kind`
    })();
    // Only a *build* failure (e.g. weight download offline) should drop the
    // cached backend so the next call retries; a compute failure keeps it.
    p.catch(() => { if (backendPromise === p) backendPromise = null; });
    backendPromise = p;
    return p;
};

self.onmessage = async (e) => {
    const msg = e.data || {};

    // Warmup: download the weights + ready the backend ahead of the first
    // humanize, streaming download progress so the UI can show a ready-up ring.
    if (msg.type === 'warmup') {
        try {
            const backend = await buildBackend((progress) => self.postMessage({ type: 'progress', progress }));
            self.postMessage({ type: 'ready', backend: backend.kind });
        } catch (err) {
            // buildBackend already cleared its cached promise on failure.
            self.postMessage({ type: 'error', error: String((err && err.message) || err) });
        }
        return;
    }

    const { id, grid, bpm } = msg;
    try {
        const backend = await buildBackend();
        // Stream each window's cumulative layer so multi-bar beats update as
        // they compute; the final message carries done:true.
        const perf = computePerfLayer(backend, grid, bpm, (partial) =>
            self.postMessage({ id, perf: partial, done: false }),
        );
        self.postMessage({ id, perf, done: true });
    } catch (err) {
        // A build failure already reset the backend (retry next call); a compute
        // failure keeps the built backend cached (no needless 15MB rebuild).
        self.postMessage({ id, error: String((err && err.message) || err) });
    }
};
