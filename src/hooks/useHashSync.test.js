// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useHashSync } from './useHashSync';

const HASH_SYNC_DELAY_MS = 180;

describe('useHashSync', () => {
    let replaceStateSpy;

    const grid = [
        [true, false, false, false],
        [false, true, false, false],
    ];
    const timeSignature = { name: '4/4' };
    const baseProps = { isSetup: true, timeSignature, grid, bpmInput: 120, activeKit: 'black-pearl' };

    beforeEach(() => {
        vi.useFakeTimers();
        replaceStateSpy = vi.spyOn(window.history, 'replaceState').mockImplementation(() => {});
        window.location.hash = '';
    });

    afterEach(() => {
        vi.runOnlyPendingTimers();
        vi.useRealTimers();
        replaceStateSpy.mockRestore();
    });

    it('writes the hash after the debounce delay when set up', () => {
        renderHook((props) => useHashSync(props), { initialProps: baseProps });

        expect(replaceStateSpy).not.toHaveBeenCalled();
        vi.advanceTimersByTime(HASH_SYNC_DELAY_MS);

        expect(replaceStateSpy).toHaveBeenCalledTimes(1);
        const [, , url] = replaceStateSpy.mock.calls[0];
        expect(url).toMatch(/^#120\|4\/4\|black-pearl\|/);
    });

    it('does not write before the debounce elapses', () => {
        renderHook((props) => useHashSync(props), { initialProps: baseProps });
        vi.advanceTimersByTime(HASH_SYNC_DELAY_MS - 1);
        expect(replaceStateSpy).not.toHaveBeenCalled();
    });

    it('does not write when not set up', () => {
        renderHook((props) => useHashSync(props), { initialProps: { ...baseProps, isSetup: false } });
        vi.advanceTimersByTime(HASH_SYNC_DELAY_MS);
        expect(replaceStateSpy).not.toHaveBeenCalled();
    });

    it('does not write without a time signature', () => {
        renderHook((props) => useHashSync(props), { initialProps: { ...baseProps, timeSignature: null } });
        vi.advanceTimersByTime(HASH_SYNC_DELAY_MS);
        expect(replaceStateSpy).not.toHaveBeenCalled();
    });

    it('does not write for an empty grid', () => {
        renderHook((props) => useHashSync(props), { initialProps: { ...baseProps, grid: [] } });
        vi.advanceTimersByTime(HASH_SYNC_DELAY_MS);
        expect(replaceStateSpy).not.toHaveBeenCalled();
    });

    it('debounces rapid changes into a single write', () => {
        const { rerender } = renderHook((props) => useHashSync(props), { initialProps: baseProps });
        rerender({ ...baseProps, bpmInput: 121 });
        rerender({ ...baseProps, bpmInput: 122 });
        vi.advanceTimersByTime(HASH_SYNC_DELAY_MS);

        expect(replaceStateSpy).toHaveBeenCalledTimes(1);
        const [, , url] = replaceStateSpy.mock.calls[0];
        expect(url).toMatch(/^#122\|/);
    });

    it('does not write again when the hash is unchanged', () => {
        const { rerender } = renderHook((props) => useHashSync(props), { initialProps: baseProps });
        vi.advanceTimersByTime(HASH_SYNC_DELAY_MS);
        expect(replaceStateSpy).toHaveBeenCalledTimes(1);

        // Re-render with identical state: the debounced write recomputes the same
        // hash and must skip the redundant replaceState.
        rerender({ ...baseProps });
        vi.advanceTimersByTime(HASH_SYNC_DELAY_MS);
        expect(replaceStateSpy).toHaveBeenCalledTimes(1);
    });

    it('clears the pending timer on unmount', () => {
        const { unmount } = renderHook((props) => useHashSync(props), { initialProps: baseProps });
        unmount();
        vi.advanceTimersByTime(HASH_SYNC_DELAY_MS);
        expect(replaceStateSpy).not.toHaveBeenCalled();
    });

    describe('external hash changes', () => {
        // An installed PWA hands a tapped share link to the running document as a
        // fragment change, so this is the only signal that a new beat arrived.
        const setHashAndFire = (hash) => {
            window.location.hash = hash;
            window.dispatchEvent(new Event('hashchange'));
        };

        it('reports a hash the app did not write', () => {
            const onExternalHash = vi.fn();
            renderHook((props) => useHashSync(props), { initialProps: { ...baseProps, onExternalHash } });

            setHashAndFire('#140|3/4|red-zeppelin|12.AAAA');

            expect(onExternalHash).toHaveBeenCalledWith('140|3/4|red-zeppelin|12.AAAA');
        });

        it('ignores the hash it just wrote itself', () => {
            const onExternalHash = vi.fn();
            renderHook((props) => useHashSync(props), { initialProps: { ...baseProps, onExternalHash } });
            vi.advanceTimersByTime(HASH_SYNC_DELAY_MS);
            const [, , written] = replaceStateSpy.mock.calls[0];

            // replaceState is spied out, so put the hash in place by hand the way a
            // real write would have, then let the event land on the listener.
            onExternalHash.mockClear();
            setHashAndFire(written);

            expect(onExternalHash).not.toHaveBeenCalled();
        });

        it('reports each distinct hash once', () => {
            const onExternalHash = vi.fn();
            renderHook((props) => useHashSync(props), { initialProps: { ...baseProps, onExternalHash } });

            setHashAndFire('#140|3/4|red-zeppelin|12.AAAA');
            setHashAndFire('#140|3/4|red-zeppelin|12.AAAA');

            expect(onExternalHash).toHaveBeenCalledTimes(1);
        });

        it('stops listening on unmount', () => {
            const onExternalHash = vi.fn();
            const { unmount } = renderHook((props) => useHashSync(props), { initialProps: { ...baseProps, onExternalHash } });
            unmount();

            setHashAndFire('#140|3/4|red-zeppelin|12.AAAA');

            expect(onExternalHash).not.toHaveBeenCalled();
        });
    });
});
