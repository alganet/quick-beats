// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadWeights } from '../utils/grooveWeights';
import { computePerfLayer } from '../utils/grooveConvert';
import { jsBackend } from '../utils/grooveModel';
import { createWasmBackend } from '../utils/grooveWasm';

vi.mock('../utils/grooveWeights', () => ({ loadWeights: vi.fn() }));
vi.mock('../utils/grooveConvert', () => ({ computePerfLayer: vi.fn() }));
vi.mock('../utils/grooveModel', () => ({ jsBackend: vi.fn() }));
vi.mock('../utils/grooveWasm', () => ({ createWasmBackend: vi.fn() }));
vi.mock('../wasm/groove.wasm?url', () => ({ default: '/groove.wasm' }));

const WEIGHTS = { fake: 'weights' };
const WASM_BACKEND = { kind: 'wasm' };
const JS_BACKEND = { kind: 'js' };
const GRID = [[true, false], [false, true]];
const PERF = { velocities: [], offsets: [] };

describe('grooveWorker', () => {
    let posted;

    // The worker is a module with a top-level side effect (self.onmessage) and a
    // module-scoped backendPromise cache. Re-importing under resetModules gives
    // each test a worker that has never built a backend — the cache is exactly
    // what several of these tests are about.
    const loadWorker = async () => {
        posted = [];
        vi.resetModules();
        vi.stubGlobal('self', { postMessage: (msg) => posted.push(msg) });
        vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) })));
        await import('./grooveWorker');
        return (data) => globalThis.self.onmessage({ data });
    };

    // The handler is async and awaits the backend build; letting the
    // microtask queue drain is what makes the posted messages observable.
    const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

    const send = async (post, data) => {
        post(data);
        await settle();
    };

    beforeEach(() => {
        loadWeights.mockResolvedValue(WEIGHTS);
        createWasmBackend.mockReturnValue(WASM_BACKEND);
        jsBackend.mockReturnValue(JS_BACKEND);
        computePerfLayer.mockReturnValue(PERF);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.clearAllMocks();
    });

    describe('warmup', () => {
        it('streams download progress and then reports the backend it settled on', async () => {
            loadWeights.mockImplementation(async (_url, onProgress) => {
                onProgress(0.5);
                onProgress(1);
                return WEIGHTS;
            });
            const post = await loadWorker();

            await send(post, { type: 'warmup' });

            expect(posted).toEqual([
                { type: 'progress', progress: 0.5 },
                { type: 'progress', progress: 1 },
                { type: 'ready', backend: 'wasm' },
            ]);
        });

        it('falls back to the JS backend when the wasm fetch fails', async () => {
            // A missing or blocked .wasm must cost speed, not the feature.
            const post = await loadWorker();
            globalThis.fetch.mockRejectedValue(new Error('404'));

            await send(post, { type: 'warmup' });

            expect(posted).toEqual([{ type: 'ready', backend: 'js' }]);
            expect(jsBackend).toHaveBeenCalledWith(WEIGHTS);
        });

        it('falls back to the JS backend when wasm instantiation throws', async () => {
            const post = await loadWorker();
            createWasmBackend.mockImplementation(() => { throw new Error('no SIMD'); });

            await send(post, { type: 'warmup' });

            expect(posted).toEqual([{ type: 'ready', backend: 'js' }]);
        });

        it('reports an error when the weights cannot be downloaded', async () => {
            const post = await loadWorker();
            loadWeights.mockRejectedValue(new Error('offline'));

            await send(post, { type: 'warmup' });

            expect(posted).toEqual([{ type: 'error', error: 'offline' }]);
        });
    });

    describe('backend caching', () => {
        it('builds the backend once across several messages', async () => {
            const post = await loadWorker();

            await send(post, { type: 'warmup' });
            await send(post, { id: 1, grid: GRID, bpm: 120 });
            await send(post, { id: 2, grid: GRID, bpm: 120 });

            expect(loadWeights).toHaveBeenCalledTimes(1);
        });

        it('shares one build between two concurrent messages', async () => {
            const post = await loadWorker();

            post({ id: 1, grid: GRID, bpm: 120 });
            post({ id: 2, grid: GRID, bpm: 120 });
            await settle();

            expect(loadWeights).toHaveBeenCalledTimes(1);
            expect(posted.filter((m) => m.done)).toHaveLength(2);
        });

        it('retries the build after a build failure', async () => {
            // Only a build failure drops the cached promise. A user who was
            // offline for the first humanize has to be able to try again once
            // the connection comes back.
            const post = await loadWorker();
            loadWeights.mockRejectedValueOnce(new Error('offline'));

            await send(post, { id: 1, grid: GRID, bpm: 120 });
            expect(posted).toEqual([{ id: 1, error: 'offline' }]);

            await send(post, { id: 2, grid: GRID, bpm: 120 });

            expect(loadWeights).toHaveBeenCalledTimes(2);
            expect(posted).toContainEqual({ id: 2, perf: PERF, done: true });
        });

        it('keeps the built backend after a compute failure', async () => {
            // The counterpart policy: a bad grid must not throw away 15 MB of
            // weights that are already downloaded and dequantized.
            const post = await loadWorker();
            computePerfLayer.mockImplementationOnce(() => { throw new Error('bad grid'); });

            await send(post, { id: 1, grid: GRID, bpm: 120 });
            expect(posted).toEqual([{ id: 1, error: 'bad grid' }]);

            await send(post, { id: 2, grid: GRID, bpm: 120 });

            expect(loadWeights).toHaveBeenCalledTimes(1);
            expect(posted).toContainEqual({ id: 2, perf: PERF, done: true });
        });
    });

    describe('compute', () => {
        it('streams a partial per window and then one final message', async () => {
            // Multi-bar beats fill in as each bar finishes rather than landing
            // all at once at the end.
            computePerfLayer.mockImplementation((_backend, _grid, _bpm, onPartial) => {
                onPartial('bar-1');
                onPartial('bar-2');
                return PERF;
            });
            const post = await loadWorker();

            await send(post, { id: 7, grid: GRID, bpm: 140 });

            expect(posted).toEqual([
                { id: 7, perf: 'bar-1', done: false },
                { id: 7, perf: 'bar-2', done: false },
                { id: 7, perf: PERF, done: true },
            ]);
        });

        it('passes the grid and bpm through to the model', async () => {
            const post = await loadWorker();

            await send(post, { id: 1, grid: GRID, bpm: 93 });

            expect(computePerfLayer).toHaveBeenCalledWith(WASM_BACKEND, GRID, 93, expect.any(Function));
        });

        it('reports download progress on a cold compute with no prior warmup', async () => {
            // Doubles as a liveness signal, so the client does not mistake a slow
            // but honest weight load for a stall.
            loadWeights.mockImplementation(async (_url, onProgress) => {
                onProgress(0.25);
                return WEIGHTS;
            });
            const post = await loadWorker();

            await send(post, { id: 1, grid: GRID, bpm: 120 });

            expect(posted[0]).toEqual({ type: 'progress', progress: 0.25 });
        });

        it('answers a failed compute against the id that asked', async () => {
            const post = await loadWorker();
            computePerfLayer.mockImplementation(() => { throw new Error('singular matrix'); });

            await send(post, { id: 42, grid: GRID, bpm: 120 });

            expect(posted).toEqual([{ id: 42, error: 'singular matrix' }]);
        });

        it('stringifies a thrown non-Error', async () => {
            const post = await loadWorker();
            computePerfLayer.mockImplementation(() => { throw 'plain string'; });

            await send(post, { id: 1, grid: GRID, bpm: 120 });

            expect(posted).toEqual([{ id: 1, error: 'plain string' }]);
        });
    });
});
