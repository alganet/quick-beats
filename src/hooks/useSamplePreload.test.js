// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { StrictMode } from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const prefetchKitSamples = vi.fn();
vi.mock('../utils/preloadSamples', () => ({
    prefetchKitSamples: (...a) => prefetchKitSamples(...a),
}));

import { useSamplePreload } from './useSamplePreload';

describe('useSamplePreload', () => {
    beforeEach(() => vi.clearAllMocks());

    it('starts not-ready and flips ready once the prefetch resolves', async () => {
        let finish;
        prefetchKitSamples.mockImplementation(() => new Promise((res) => { finish = res; }));
        const { result } = renderHook(() => useSamplePreload());

        expect(result.current.ready).toBe(false);
        await act(async () => { finish(); });
        await waitFor(() => expect(result.current.ready).toBe(true));
    });

    it('forwards prefetch progress', async () => {
        let report;
        prefetchKitSamples.mockImplementation((_kit, onProgress) => {
            report = onProgress;
            return Promise.resolve();
        });
        const { result } = renderHook(() => useSamplePreload());
        act(() => { report(0.5); });
        expect(result.current.progress).toBeCloseTo(0.5);
    });

    it('under StrictMode, prefetches once and still becomes ready', async () => {
        prefetchKitSamples.mockResolvedValue(undefined);
        const { result } = renderHook(() => useSamplePreload(), { wrapper: StrictMode });
        // StrictMode double-invokes the mount effect; the prefetch must fire once
        // and its completion must still flip `ready` (regression: cleanup flag
        // used to suppress it, leaving the app stuck on the loading screen).
        expect(prefetchKitSamples).toHaveBeenCalledTimes(1);
        await waitFor(() => expect(result.current.ready).toBe(true));
    });

    it('becomes ready even if the prefetch rejects', async () => {
        prefetchKitSamples.mockRejectedValue(new Error('boom'));
        const { result } = renderHook(() => useSamplePreload());
        await waitFor(() => expect(result.current.ready).toBe(true));
    });
});
