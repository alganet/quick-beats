// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useLandscapeLock } from './useLandscapeLock';

const original = {};

/** Mocks a device where rotation works: touch input, fullscreen, and lock(). */
function mockAndroid({ lock } = {}) {
    window.matchMedia = vi.fn().mockImplementation((query) => ({
        matches: query === '(pointer: coarse)',
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
    }));
    Object.defineProperty(document, 'fullscreenEnabled', { value: true, configurable: true });
    Object.defineProperty(document, 'fullscreenElement', { value: null, writable: true, configurable: true });
    document.documentElement.requestFullscreen = vi.fn().mockResolvedValue(undefined);
    document.exitFullscreen = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window.screen, 'orientation', {
        value: { lock: lock ?? vi.fn().mockResolvedValue(undefined), unlock: vi.fn() },
        writable: true,
        configurable: true,
    });
}

beforeEach(() => {
    original.matchMedia = window.matchMedia;
    original.requestFullscreen = document.documentElement.requestFullscreen;
    original.exitFullscreen = document.exitFullscreen;
    mockAndroid();
});

afterEach(() => {
    window.matchMedia = original.matchMedia;
    document.documentElement.requestFullscreen = original.requestFullscreen;
    document.exitFullscreen = original.exitFullscreen;
    delete document.fullscreenEnabled;
    delete document.fullscreenElement;
    delete window.screen.orientation;
    vi.clearAllMocks();
});

describe('useLandscapeLock', () => {
    it('offers rotation on a touch device with fullscreen and lock()', () => {
        const { result } = renderHook(() => useLandscapeLock());
        expect(result.current.available).toBe(true);
        expect(result.current.canRotate).toBe(true);
    });

    it('offers nothing on iOS, where fullscreen is missing despite screen.orientation existing', () => {
        Object.defineProperty(document, 'fullscreenEnabled', { value: false, configurable: true });
        const { result } = renderHook(() => useLandscapeLock());
        expect(result.current.available).toBe(false);
        expect(result.current.canRotate).toBe(false);
    });

    it('offers nothing on desktop, where the pointer is fine', () => {
        window.matchMedia = vi.fn().mockImplementation((query) => ({
            matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(),
        }));
        const { result } = renderHook(() => useLandscapeLock());
        expect(result.current.available).toBe(false);
    });

    it('still offers plain fullscreen where the browser has no orientation.lock()', () => {
        // Fullscreen reclaims the browser chrome on its own, so losing lock() must
        // downgrade the control rather than withdraw it.
        delete window.screen.orientation;
        const { result } = renderHook(() => useLandscapeLock());
        expect(result.current.available).toBe(true);
        expect(result.current.canRotate).toBe(false);
    });

    it('enters fullscreen before locking, since lock() rejects otherwise', async () => {
        // Mirrors the real constraint rather than just asserting call order: this
        // lock() throws unless the document is already fullscreen, so a missing
        // await in enter() surfaces as lockRejected.
        let fullscreen = false;
        document.documentElement.requestFullscreen = vi.fn(async () => {
            // Resolve on a later microtask, as the real API does. Without this the
            // flag would be set synchronously and a missing await would still pass.
            await Promise.resolve();
            fullscreen = true;
        });
        const lock = vi.fn(async () => {
            if (!fullscreen) throw new Error('not fullscreen');
        });
        Object.defineProperty(window.screen, 'orientation', { value: { lock }, writable: true, configurable: true });

        const { result } = renderHook(() => useLandscapeLock());
        await act(async () => { await result.current.enter(); });

        expect(lock).toHaveBeenCalledWith('landscape');
        expect(result.current.canRotate).toBe(true);
    });

    it('keeps fullscreen and stops advertising rotation when lock() rejects', async () => {
        mockAndroid({ lock: vi.fn().mockRejectedValue(new Error('NotSupportedError')) });
        const { result } = renderHook(() => useLandscapeLock());

        await act(async () => { await result.current.enter(); });

        expect(document.documentElement.requestFullscreen).toHaveBeenCalled();
        expect(document.exitFullscreen).not.toHaveBeenCalled();
        expect(result.current.canRotate).toBe(false);
    });

    it('survives a rejected lock and a round trip out of fullscreen, still offering fullscreen', async () => {
        // Regression: a refused lock used to retract the control entirely, so
        // entering fullscreen once and leaving it left no way to get back in —
        // even though the fullscreen half had worked perfectly both times.
        mockAndroid({ lock: vi.fn().mockRejectedValue(new Error('NotSupportedError')) });
        const { result } = renderHook(() => useLandscapeLock());

        await act(async () => { await result.current.enter(); });
        document.fullscreenElement = document.documentElement;
        await act(async () => { document.dispatchEvent(new Event('fullscreenchange')); });
        expect(result.current.isFullscreen).toBe(true);
        expect(result.current.available).toBe(true);

        await act(async () => { await result.current.exit(); });
        document.fullscreenElement = null;
        await act(async () => { document.dispatchEvent(new Event('fullscreenchange')); });

        expect(result.current.isFullscreen).toBe(false);
        // The control must still be offered, just as fullscreen rather than rotate.
        expect(result.current.available).toBe(true);
        expect(result.current.canRotate).toBe(false);
    });

    it('does not attempt to lock when fullscreen itself is refused', async () => {
        const lock = vi.fn();
        Object.defineProperty(window.screen, 'orientation', { value: { lock }, writable: true, configurable: true });
        document.documentElement.requestFullscreen = vi.fn().mockRejectedValue(new Error('denied'));

        const { result } = renderHook(() => useLandscapeLock());
        await act(async () => { await result.current.enter(); });

        expect(lock).not.toHaveBeenCalled();
    });

    it('tracks an exit the app did not initiate, such as Esc or the back gesture', async () => {
        const { result } = renderHook(() => useLandscapeLock());

        document.fullscreenElement = document.documentElement;
        await act(async () => { document.dispatchEvent(new Event('fullscreenchange')); });
        expect(result.current.isFullscreen).toBe(true);

        document.fullscreenElement = null;
        await act(async () => { document.dispatchEvent(new Event('fullscreenchange')); });
        expect(result.current.isFullscreen).toBe(false);
    });

    it('exits via exitFullscreen, which releases the lock implicitly', async () => {
        const { result } = renderHook(() => useLandscapeLock());
        await act(async () => { await result.current.exit(); });
        expect(document.exitFullscreen).toHaveBeenCalled();
        expect(window.screen.orientation.unlock).not.toHaveBeenCalled();
    });
});
