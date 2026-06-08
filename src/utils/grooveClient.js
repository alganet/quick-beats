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

// If a request neither finishes nor errors within this window — measured from
// its last sign of life (sent, or a streamed window received) — treat it as
// stalled: drop the entry and reject so its Promise can't hang forever. The
// rejection flows to the caller (useHumanize -> phase='error' -> Retry).
const REQUEST_TIMEOUT_MS = 30000;

const clearEntryTimer = (entry) => {
    if (entry && entry.timer !== null) {
        clearTimeout(entry.timer);
        entry.timer = null;
    }
};

// (Re)arm the stall timeout for a pending request. Called when the request is
// sent and reset on each streamed partial, so it measures silence, not total
// compute time.
const armTimeout = (id) => {
    const entry = pending.get(id);
    if (!entry) return;
    clearEntryTimer(entry);
    entry.timer = setTimeout(() => {
        pending.delete(id);
        entry.reject(new Error('groove worker timed out'));
    }, REQUEST_TIMEOUT_MS);
};

// Same stall protection for the one-shot warmup: a silent stall during the
// multi-MB weight download would otherwise hang its Promise forever, leaving
// the UI stuck on the loading ring with no way to retry. Reset on every
// progress tick so an honestly-downloading worker is never killed.
const clearWarmupTimer = () => {
    if (warmup && warmup.timer !== null) {
        clearTimeout(warmup.timer);
        warmup.timer = null;
    }
};

const armWarmupTimeout = () => {
    if (!warmup) return;
    clearWarmupTimer();
    warmup.timer = setTimeout(() => {
        const stalled = warmup;
        warmup = null; // let a retry re-warm
        stalled.reject(new Error('groove warmup timed out'));
    }, REQUEST_TIMEOUT_MS);
};

const ensureWorker = () => {
    if (worker) return worker;
    worker = new Worker(new URL('../workers/grooveWorker.js', import.meta.url), {
        type: 'module',
    });
    worker.onmessage = ({ data }) => {
        // Warmup messages are type-tagged (no request id).
        if (data.type) {
            if (data.type === 'progress') {
                warmup?.onProgress?.(data.progress);
                // A progress tick proves the worker is alive and downloading, so
                // reset the stall clocks: the warmup's own, plus any compute that
                // is blocked awaiting the same backend build (no partials stream
                // until the weights finish loading).
                armWarmupTimeout();
                pending.forEach((_entry, pid) => armTimeout(pid));
            } else if (data.type === 'ready') {
                clearWarmupTimer();
                warmup?.resolve(data.backend); // 'wasm' | 'js'
            } else if (data.type === 'error') {
                clearWarmupTimer();
                warmup?.reject(new Error(data.error || 'groove warmup error'));
                warmup = null; // let a retry re-warm
            }
            return;
        }
        const { id, perf, error, done } = data;
        const entry = pending.get(id);
        if (!entry) return;
        if (error) {
            clearEntryTimer(entry);
            pending.delete(id);
            entry.reject(new Error(error));
        } else if (done === false) {
            entry.onPartial?.(perf); // streamed window; keep the entry pending
            armTimeout(id); // a window landed — reset the stall clock
        } else {
            clearEntryTimer(entry);
            pending.delete(id);
            entry.resolve(perf);
        }
    };
    worker.onerror = (event) => {
        const err = new Error(event.message || 'groove worker error');
        pending.forEach((entry) => { clearEntryTimer(entry); entry.reject(err); });
        pending.clear();
        clearWarmupTimer();
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
        pending.set(id, { resolve, reject, onPartial, timer: null });
        ensureWorker().postMessage({ id, grid, bpm });
        armTimeout(id);
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
    warmup = { promise, resolve, reject, onProgress, timer: null };
    ensureWorker().postMessage({ type: 'warmup' });
    armWarmupTimeout();
    return promise;
};

// Test seam: tear down the worker + pending requests.
export const __resetGrooveClient = () => {
    if (worker) {
        try { worker.terminate(); } catch { /* ignore */ }
    }
    worker = null;
    pending.forEach((entry) => clearEntryTimer(entry));
    pending.clear();
    clearWarmupTimer();
    warmup = null;
    seq = 0;
};
