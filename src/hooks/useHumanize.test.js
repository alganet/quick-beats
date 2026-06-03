// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const computeHumanization = vi.fn();
vi.mock('../utils/grooveClient', () => ({
    computeHumanization: (...a) => computeHumanization(...a),
}));

import { useHumanize } from './useHumanize';

const fakePerf = () => [[{ vel: 0.5, offsetSec: 0 }]];
const grid = [[true, false]];

describe('useHumanize', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        computeHumanization.mockResolvedValue(fakePerf());
    });

    it('starts idle', () => {
        const { result } = renderHook(() => useHumanize());
        expect(result.current.phase).toBe('idle');
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
        expect(computeHumanization).toHaveBeenCalledWith(grid, 120);
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
