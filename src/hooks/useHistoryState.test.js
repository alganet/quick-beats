// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useHistoryState } from './useHistoryState';

const HASH_SYNC_DELAY_MS = 180;

describe('useHistoryState', () => {
    let replaceStateSpy;
    let pushStateSpy;

    const grid = [
        [true, false, false, false],
        [false, true, false, false],
    ];
    const timeSignature = { name: '4/4' };
    const baseProps = { isSetup: true, timeSignature, grid, bpmInput: 120, activeKit: 'black-pearl', overlay: 'none' };

    beforeEach(() => {
        vi.useFakeTimers();
        replaceStateSpy = vi.spyOn(window.history, 'replaceState').mockImplementation(() => {});
        pushStateSpy = vi.spyOn(window.history, 'pushState').mockImplementation(() => {});
        window.location.hash = '';
    });

    afterEach(() => {
        vi.runOnlyPendingTimers();
        vi.useRealTimers();
        replaceStateSpy.mockRestore();
        pushStateSpy.mockRestore();
    });

    // --- Beat sync (ported from useHashSync) --------------------------------

    it('writes the beat hash after the debounce delay when set up', () => {
        renderHook((props) => useHistoryState(props), { initialProps: baseProps });

        expect(replaceStateSpy).not.toHaveBeenCalled();
        vi.advanceTimersByTime(HASH_SYNC_DELAY_MS);

        expect(replaceStateSpy).toHaveBeenCalledTimes(1);
        const [, , url] = replaceStateSpy.mock.calls[0];
        expect(url).toMatch(/^#120\|4\/4\|black-pearl\|/);
    });

    it('does not write before the debounce elapses', () => {
        renderHook((props) => useHistoryState(props), { initialProps: baseProps });
        vi.advanceTimersByTime(HASH_SYNC_DELAY_MS - 1);
        expect(replaceStateSpy).not.toHaveBeenCalled();
    });

    it('does not write when not set up', () => {
        renderHook((props) => useHistoryState(props), { initialProps: { ...baseProps, isSetup: false } });
        vi.advanceTimersByTime(HASH_SYNC_DELAY_MS);
        expect(replaceStateSpy).not.toHaveBeenCalled();
    });

    it('does not write without a time signature', () => {
        renderHook((props) => useHistoryState(props), { initialProps: { ...baseProps, timeSignature: null } });
        vi.advanceTimersByTime(HASH_SYNC_DELAY_MS);
        expect(replaceStateSpy).not.toHaveBeenCalled();
    });

    it('does not write for an empty grid', () => {
        renderHook((props) => useHistoryState(props), { initialProps: { ...baseProps, grid: [] } });
        vi.advanceTimersByTime(HASH_SYNC_DELAY_MS);
        expect(replaceStateSpy).not.toHaveBeenCalled();
    });

    it('debounces rapid changes into a single write', () => {
        const { rerender } = renderHook((props) => useHistoryState(props), { initialProps: baseProps });
        rerender({ ...baseProps, bpmInput: 121 });
        rerender({ ...baseProps, bpmInput: 122 });
        vi.advanceTimersByTime(HASH_SYNC_DELAY_MS);

        expect(replaceStateSpy).toHaveBeenCalledTimes(1);
        const [, , url] = replaceStateSpy.mock.calls[0];
        expect(url).toMatch(/^#122\|/);
    });

    it('does not write again when the hash is unchanged', () => {
        const { rerender } = renderHook((props) => useHistoryState(props), { initialProps: baseProps });
        vi.advanceTimersByTime(HASH_SYNC_DELAY_MS);
        expect(replaceStateSpy).toHaveBeenCalledTimes(1);

        rerender({ ...baseProps });
        vi.advanceTimersByTime(HASH_SYNC_DELAY_MS);
        expect(replaceStateSpy).toHaveBeenCalledTimes(1);
    });

    it('clears the pending timer on unmount', () => {
        const { unmount } = renderHook((props) => useHistoryState(props), { initialProps: baseProps });
        unmount();
        vi.advanceTimersByTime(HASH_SYNC_DELAY_MS);
        expect(replaceStateSpy).not.toHaveBeenCalled();
    });

    it('stamps the beat entry with a qb history state', () => {
        renderHook((props) => useHistoryState(props), { initialProps: baseProps });
        vi.advanceTimersByTime(HASH_SYNC_DELAY_MS);
        const [state] = replaceStateSpy.mock.calls[0];
        expect(state).toMatchObject({ qb: 1, overlay: 'none' });
    });

    // --- Overlays: push / pop / debounce interaction ------------------------

    it('openOverlay pushes a history entry immediately (not debounced)', () => {
        const { result } = renderHook((props) => useHistoryState(props), { initialProps: baseProps });

        act(() => result.current.openOverlay('help'));

        expect(pushStateSpy).toHaveBeenCalledTimes(1);
        const [state, , url] = pushStateSpy.mock.calls[0];
        expect(state).toMatchObject({ qb: 1, overlay: 'help' });
        expect(url).toMatch(/^#help~120\|4\/4\|black-pearl\|4\./); // overlay~beat, 4-col grid
    });

    it('a pending beat write does not clobber an open overlay (no dropped ~)', () => {
        // Open help, then let the debounced beat write fire while overlay='help'.
        const { result, rerender } = renderHook((props) => useHistoryState(props), { initialProps: baseProps });
        act(() => result.current.openOverlay('help'));
        pushStateSpy.mockClear();
        replaceStateSpy.mockClear();

        // App would flip overlay to 'help' after opening; reflect that and edit bpm.
        rerender({ ...baseProps, overlay: 'help', bpmInput: 130 });
        vi.advanceTimersByTime(HASH_SYNC_DELAY_MS);

        expect(replaceStateSpy).toHaveBeenCalledTimes(1);
        const [, , url] = replaceStateSpy.mock.calls[0];
        expect(url).toMatch(/^#help~130\|/); // still prefixed — overlay preserved
    });

    it('popstate closes to the target entry overlay', () => {
        const onPopOverlay = vi.fn();
        renderHook((props) => useHistoryState(props), { initialProps: { ...baseProps, onPopOverlay } });

        act(() => window.dispatchEvent(Object.assign(new Event('popstate'), { state: { qb: 1, overlay: 'none' } })));
        expect(onPopOverlay).toHaveBeenCalledWith('none');

        act(() => window.dispatchEvent(Object.assign(new Event('popstate'), { state: { qb: 1, overlay: 'share' } })));
        expect(onPopOverlay).toHaveBeenLastCalledWith('share');
    });

    it('treats a null-state popstate as no overlay', () => {
        const onPopOverlay = vi.fn();
        renderHook((props) => useHistoryState(props), { initialProps: { ...baseProps, onPopOverlay } });
        act(() => window.dispatchEvent(Object.assign(new Event('popstate'), { state: null })));
        expect(onPopOverlay).toHaveBeenCalledWith('none');
    });

    // --- Deep-link synthesis -------------------------------------------------

    it('synthesizes a base entry beneath a deep-linked overlay', () => {
        window.location.hash = '#help~120|4/4|black-pearl|16.QAAA';
        renderHook((props) => useHistoryState(props), { initialProps: { ...baseProps, overlay: 'help' } });

        // replaceState lays the base beat entry, pushState the overlay entry.
        expect(replaceStateSpy).toHaveBeenCalledTimes(1);
        expect(replaceStateSpy.mock.calls[0][2]).toBe('#120|4/4|black-pearl|16.QAAA');
        expect(pushStateSpy).toHaveBeenCalledTimes(1);
        expect(pushStateSpy.mock.calls[0][2]).toBe('#help~120|4/4|black-pearl|16.QAAA');
    });

    it('does not synthesize history for a plain beat load', () => {
        window.location.hash = '#120|4/4|black-pearl|16.QAAA';
        renderHook((props) => useHistoryState(props), { initialProps: baseProps });
        // No mount-time push; the beat entry is stamped lazily by the beat sync.
        expect(pushStateSpy).not.toHaveBeenCalled();
    });

    it('does not synthesize again on a reload of an already-stamped entry', () => {
        // history.state survives a reload: the base entry from the last visit is
        // still beneath us. Re-synthesizing would add one ghost entry per reload.
        window.location.hash = '#help~120|4/4|black-pearl|16.QAAA';
        const stateSpy = vi.spyOn(window.history, 'state', 'get')
            .mockReturnValue({ qb: 1, overlay: 'help' });
        renderHook((props) => useHistoryState(props), { initialProps: { ...baseProps, overlay: 'help' } });

        expect(pushStateSpy).not.toHaveBeenCalled();
        stateSpy.mockRestore();
    });

    // --- External hash (ported) ---------------------------------------------

    describe('external hash changes', () => {
        const setHashAndFire = (hash) => {
            window.location.hash = hash;
            window.dispatchEvent(new Event('hashchange'));
        };

        it('reports a hash the app did not write', () => {
            const onExternalHash = vi.fn();
            renderHook((props) => useHistoryState(props), { initialProps: { ...baseProps, onExternalHash } });

            setHashAndFire('#140|3/4|red-zeppelin|12.AAAA');

            expect(onExternalHash).toHaveBeenCalledWith('140|3/4|red-zeppelin|12.AAAA');
        });

        it('reports an external overlay link', () => {
            const onExternalHash = vi.fn();
            renderHook((props) => useHistoryState(props), { initialProps: { ...baseProps, onExternalHash } });

            setHashAndFire('#help~140|3/4|red-zeppelin|12.AAAA');

            expect(onExternalHash).toHaveBeenCalledWith('help~140|3/4|red-zeppelin|12.AAAA');
        });

        it('ignores a fragment change on an entry we stamped (our own back/forward)', () => {
            const onExternalHash = vi.fn();
            renderHook((props) => useHistoryState(props), { initialProps: { ...baseProps, onExternalHash } });

            const stateGetter = vi.spyOn(window.history, 'state', 'get').mockReturnValue({ qb: 1, overlay: 'none' });
            setHashAndFire('#120|4/4|black-pearl|16.QAAA');
            expect(onExternalHash).not.toHaveBeenCalled();
            stateGetter.mockRestore();
        });

        it('reports each distinct hash once', () => {
            const onExternalHash = vi.fn();
            renderHook((props) => useHistoryState(props), { initialProps: { ...baseProps, onExternalHash } });

            setHashAndFire('#140|3/4|red-zeppelin|12.AAAA');
            setHashAndFire('#140|3/4|red-zeppelin|12.AAAA');

            expect(onExternalHash).toHaveBeenCalledTimes(1);
        });

        it('stops listening on unmount', () => {
            const onExternalHash = vi.fn();
            const { unmount } = renderHook((props) => useHistoryState(props), { initialProps: { ...baseProps, onExternalHash } });
            unmount();

            setHashAndFire('#140|3/4|red-zeppelin|12.AAAA');

            expect(onExternalHash).not.toHaveBeenCalled();
        });
    });
});
