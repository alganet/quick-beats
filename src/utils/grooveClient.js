// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

// Thin main-thread client for the GrooVAE worker. Lazily spawns the worker on
// first use and resolves each request by id. Keeps all model work (and the
// 7.8MB weight load) off the main thread.

let worker = null;
let seq = 0;
const pending = new Map();
// Single in-flight/settled warmup (weight preload). Type-tagged messages from
// the worker ({ type: 'progress' | 'ready' | 'error' }) drive it.
let warmup = null;

const ensureWorker = () => {
    if (worker) return worker;
    worker = new Worker(new URL('../workers/grooveWorker.js', import.meta.url), {
        type: 'module',
    });
    worker.onmessage = ({ data }) => {
        // Warmup messages are type-tagged (no request id).
        if (data.type) {
            if (data.type === 'progress') warmup?.onProgress?.(data.progress);
            else if (data.type === 'ready') warmup?.resolve(data.backend); // 'wasm' | 'js'
            else if (data.type === 'error') {
                warmup?.reject(new Error(data.error || 'groove warmup error'));
                warmup = null; // let a retry re-warm
            }
            return;
        }
        const { id, perf, error, done } = data;
        const entry = pending.get(id);
        if (!entry) return;
        if (error) {
            pending.delete(id);
            entry.reject(new Error(error));
        } else if (done === false) {
            entry.onPartial?.(perf); // streamed window; keep the entry pending
        } else {
            pending.delete(id);
            entry.resolve(perf);
        }
    };
    worker.onerror = (event) => {
        const err = new Error(event.message || 'groove worker error');
        pending.forEach((entry) => entry.reject(err));
        pending.clear();
        warmup?.reject(err);
        warmup = null;
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
 * thread. Returns a Promise resolving to the final layer (or null if nothing to
 * do). `onPartial`, if given, is called with the cumulative layer after each
 * window so the UI can stream results (the grid fills in bar by bar).
 */
export const computeHumanization = (grid, bpm, onPartial) =>
    new Promise((resolve, reject) => {
        const id = ++seq;
        pending.set(id, { resolve, reject, onPartial });
        ensureWorker().postMessage({ id, grid, bpm });
    });

/**
 * Start downloading the GrooVAE weights ahead of the first humanize, off the
 * main thread. Deduped: repeated calls return the same promise (and update the
 * progress callback). Resolves when the weights are loaded; rejects on failure
 * (clearing state so a later call retries).
 *
 * @param {(progress: number) => void} [onProgress] download progress 0..1.
 * @returns {Promise<'wasm'|'js'|undefined>} the compute backend the worker chose.
 */
export const warmupWeights = (onProgress) => {
    if (warmup) {
        if (onProgress) warmup.onProgress = onProgress;
        return warmup.promise;
    }
    let resolve;
    let reject;
    const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
    warmup = { promise, resolve, reject, onProgress };
    ensureWorker().postMessage({ type: 'warmup' });
    return promise;
};

// Test seam: tear down the worker + pending requests.
export const __resetGrooveClient = () => {
    if (worker) {
        try { worker.terminate(); } catch { /* ignore */ }
    }
    worker = null;
    pending.clear();
    warmup = null;
    seq = 0;
};
