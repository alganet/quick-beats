// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const computeHumanization = vi.fn();
const warmupWeights = vi.fn();
vi.mock('../utils/grooveClient', () => ({
    computeHumanization: (...a) => computeHumanization(...a),
    warmupWeights: (...a) => warmupWeights(...a),
}));

import { useHumanize } from './useHumanize';

const fakePerf = () => [[{ vel: 0.5, offsetSec: 0 }]];
const grid = [[true, false]];

describe('useHumanize', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        computeHumanization.mockResolvedValue(fakePerf());
        warmupWeights.mockResolvedValue(undefined);
    });

    it('starts idle', () => {
        const { result } = renderHook(() => useHumanize());
        expect(result.current.phase).toBe('idle');
    });

    it('starts with the model unloaded (modelPhase idle)', () => {
        const { result } = renderHook(() => useHumanize());
        expect(result.current.modelPhase).toBe('idle');
        expect(result.current.modelProgress).toBe(0);
    });

    it('warmup walks loading -> ready, forwarding progress and the backend kind', async () => {
        let reportProgress;
        warmupWeights.mockImplementation((onProgress) => {
            reportProgress = onProgress;
            return new Promise((resolve) => { warmupWeights.resolve = resolve; });
        });
        const { result } = renderHook(() => useHumanize());

        act(() => { result.current.warmup(); });
        expect(result.current.modelPhase).toBe('loading');
        expect(result.current.computeBackend).toBeNull();

        act(() => { reportProgress(0.4); });
        expect(result.current.modelProgress).toBeCloseTo(0.4);

        await act(async () => { warmupWeights.resolve('wasm'); });
        expect(result.current.modelPhase).toBe('ready');
        expect(result.current.modelProgress).toBe(1);
        expect(result.current.computeBackend).toBe('wasm');
    });

    it('defaults computeBackend to "js" when warmup resolves without a kind', async () => {
        warmupWeights.mockResolvedValue(undefined);
        const { result } = renderHook(() => useHumanize());
        await act(async () => { result.current.warmup(); });
        await waitFor(() => expect(result.current.computeBackend).toBe('js'));
    });

    it('warmup goes to error when the download rejects', async () => {
        warmupWeights.mockRejectedValue(new Error('offline'));
        const { result } = renderHook(() => useHumanize());
        await act(async () => { result.current.warmup(); });
        await waitFor(() => expect(result.current.modelPhase).toBe('error'));
    });

    it('retry after an error resets progress so the prior percent does not flash', async () => {
        let rejectFn;
        let reportProgress;
        warmupWeights.mockImplementationOnce((onProgress) => {
            reportProgress = onProgress;
            return new Promise((_, rej) => { rejectFn = rej; });
        });
        const { result } = renderHook(() => useHumanize());

        act(() => { result.current.warmup(); });
        act(() => { reportProgress(0.7); });
        expect(result.current.modelProgress).toBeCloseTo(0.7);

        await act(async () => { rejectFn(new Error('offline')); });
        expect(result.current.modelPhase).toBe('error');

        // Retry: the ring snaps back to 0 immediately rather than showing 70%.
        warmupWeights.mockImplementationOnce(() => new Promise(() => {})); // stays loading
        act(() => { result.current.warmup(); });
        expect(result.current.modelProgress).toBe(0);
        expect(result.current.modelPhase).toBe('loading');
    });

    it('compute returns null for an empty grid without invoking the worker', async () => {
        const { result } = renderHook(() => useHumanize());
        let out;
        await act(async () => { out = await result.current.compute([], 120); });
        expect(out).toBeNull();
        expect(computeHumanization).not.toHaveBeenCalled();
    });

    it('compute delegates to the worker client and resolves the layer', async () => {
        const { result } = renderHook(() => useHumanize());
        let out;
        await act(async () => { out = await result.current.compute(grid, 120); });
        expect(computeHumanization).toHaveBeenCalledWith(grid, 120, expect.any(Function));
        expect(out).toEqual(fakePerf());
        await waitFor(() => expect(result.current.phase).toBe('ready'));
    });

    it('sets phase to error when the worker rejects', async () => {
        computeHumanization.mockRejectedValue(new Error('offline'));
        const { result } = renderHook(() => useHumanize());
        let out;
        await act(async () => { out = await result.current.compute(grid, 120); });
        expect(out).toBeNull();
        expect(result.current.phase).toBe('error');
    });

    it('forwards streamed partials, dropping those from a superseded compute', () => {
        const captured = [];
        computeHumanization.mockImplementation((g, bpm, onPartial) => {
            captured.push(onPartial);
            return new Promise(() => {}); // pending; we only exercise partials here
        });
        const { result } = renderHook(() => useHumanize());
        const seen1 = vi.fn();
        const seen2 = vi.fn();
        act(() => { result.current.compute(grid, 120, seen1); }); // request 1
        act(() => { result.current.compute(grid, 120, seen2); }); // request 2 supersedes 1
        act(() => { captured[0]('p1'); captured[1]('p2'); });
        expect(seen1).not.toHaveBeenCalled(); // superseded -> dropped
        expect(seen2).toHaveBeenCalledWith('p2');
    });

    it('discards superseded results (latest-wins)', async () => {
        const { result } = renderHook(() => useHumanize());
        let r1, r2;
        await act(async () => {
            const p1 = result.current.compute(grid, 120);
            const p2 = result.current.compute(grid, 120);
            [r1, r2] = await Promise.all([p1, p2]);
        });
        expect(r1).toBeNull();
        expect(r2).toEqual(fakePerf());
    });
});
