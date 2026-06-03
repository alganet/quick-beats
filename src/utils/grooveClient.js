// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

// Thin main-thread client for the GrooVAE worker. Lazily spawns the worker on
// first use and resolves each request by id. Keeps all model work (and the
// 7.8MB weight load) off the main thread.

let worker = null;
let seq = 0;
const pending = new Map();

const ensureWorker = () => {
    if (worker) return worker;
    worker = new Worker(new URL('../workers/grooveWorker.js', import.meta.url), {
        type: 'module',
    });
    worker.onmessage = ({ data: { id, perf, error } }) => {
        const entry = pending.get(id);
        if (!entry) return;
        pending.delete(id);
        if (error) entry.reject(new Error(error));
        else entry.resolve(perf);
    };
    worker.onerror = (event) => {
        const err = new Error(event.message || 'groove worker error');
        pending.forEach((entry) => entry.reject(err));
        pending.clear();
        // A worker-level failure (e.g. a module that won't load) leaves the worker
        // permanently dead. Discard it so the next call — including a Retry — spins
        // up a fresh one instead of posting into the void.
        try { worker.terminate(); } catch { /* ignore */ }
        worker = null;
    };
    return worker;
};

/**
 * Compute a humanized performance layer for `grid` at `bpm`, off the main
 * thread. Returns a Promise resolving to the layer (or null if nothing to do).
 */
export const computeHumanization = (grid, bpm) =>
    new Promise((resolve, reject) => {
        const id = ++seq;
        pending.set(id, { resolve, reject });
        ensureWorker().postMessage({ id, grid, bpm });
    });

// Test seam: tear down the worker + pending requests.
export const __resetGrooveClient = () => {
    if (worker) {
        try { worker.terminate(); } catch { /* ignore */ }
    }
    worker = null;
    pending.clear();
    seq = 0;
};
