// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { describe, it, expect, vi, afterEach } from 'vitest';
import { prefetchKitSamples } from './preloadSamples';
import { KITS } from '../data/kit';

describe('prefetchKitSamples', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('fetches every sample of the kit and reports progress 0 -> 1', async () => {
        const fetchMock = vi.fn(() => Promise.resolve({ blob: () => Promise.resolve(new Blob()) }));
        vi.stubGlobal('fetch', fetchMock);

        const onProgress = vi.fn();
        await prefetchKitSamples('black-pearl', onProgress);

        const sampleCount = Object.keys(KITS['black-pearl'].samples).length;
        expect(fetchMock).toHaveBeenCalledTimes(sampleCount);
        expect(onProgress).toHaveBeenNthCalledWith(1, 0);
        expect(onProgress).toHaveBeenLastCalledWith(1);
    });

    it('never rejects when a fetch fails (first play falls back to Tone)', async () => {
        vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))));
        const onProgress = vi.fn();
        await expect(prefetchKitSamples('black-pearl', onProgress)).resolves.toBeUndefined();
        expect(onProgress).toHaveBeenLastCalledWith(1);
    });

    it('resolves immediately for an unknown kit', async () => {
        const onProgress = vi.fn();
        await prefetchKitSamples('nope', onProgress);
        expect(onProgress).toHaveBeenCalledWith(1);
    });
});
