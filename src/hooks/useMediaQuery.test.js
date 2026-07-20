// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { useMediaQuery } from './useMediaQuery';

describe('useMediaQuery', () => {
    afterEach(() => vi.unstubAllGlobals());

    // A controllable MediaQueryList. `matches` is mutable so a test can flip it
    // before firing change, which is the order the real thing uses.
    const makeMql = (matches = false) => {
        const listeners = new Set();
        return {
            matches,
            addEventListener: vi.fn((_type, fn) => listeners.add(fn)),
            removeEventListener: vi.fn((_type, fn) => listeners.delete(fn)),
            fire() { listeners.forEach((fn) => fn()); },
            listenerCount: () => listeners.size,
        };
    };

    const stubMatchMedia = (mql) => {
        const matchMedia = vi.fn(() => mql);
        vi.stubGlobal('matchMedia', matchMedia);
        return matchMedia;
    };

    it('returns whether the query currently matches', () => {
        stubMatchMedia(makeMql(true));
        const { result } = renderHook(() => useMediaQuery('(orientation: landscape)'));
        expect(result.current).toBe(true);
    });

    it('re-reads matches when the list changes rather than trusting a captured value', () => {
        // matches is updated before the change event fires, so the snapshot has
        // to read through to the live list. Capturing it at subscribe time would
        // pass a naive test and then report a stale orientation forever.
        const mql = makeMql(false);
        stubMatchMedia(mql);
        const { result } = renderHook(() => useMediaQuery('(orientation: landscape)'));
        expect(result.current).toBe(false);

        act(() => {
            mql.matches = true;
            mql.fire();
        });

        expect(result.current).toBe(true);
    });

    it('passes the query straight through to matchMedia', () => {
        const matchMedia = stubMatchMedia(makeMql());
        renderHook(() => useMediaQuery('(min-width: 640px)'));
        expect(matchMedia).toHaveBeenCalledWith('(min-width: 640px)');
    });

    it('re-subscribes against a new list when the query changes', () => {
        const first = makeMql(false);
        const second = makeMql(true);
        const matchMedia = vi.fn((q) => (q === 'a' ? first : second));
        vi.stubGlobal('matchMedia', matchMedia);

        const { result, rerender } = renderHook(({ q }) => useMediaQuery(q), { initialProps: { q: 'a' } });
        expect(result.current).toBe(false);

        rerender({ q: 'b' });

        expect(matchMedia).toHaveBeenCalledWith('b');
        expect(first.listenerCount()).toBe(0);
        expect(result.current).toBe(true);
    });

    it('removes the same handler it added on unmount', () => {
        const mql = makeMql();
        stubMatchMedia(mql);
        const { unmount } = renderHook(() => useMediaQuery('(orientation: landscape)'));

        unmount();

        expect(mql.removeEventListener).toHaveBeenCalledWith('change', mql.addEventListener.mock.calls[0][1]);
        expect(mql.listenerCount()).toBe(0);
    });

    // Callers are feature-detection paths — a query that cannot be evaluated has
    // to report false and let the app render, never throw.
    describe('environments without a usable matchMedia', () => {
        it('reports false when matchMedia is absent entirely', () => {
            vi.stubGlobal('matchMedia', undefined);
            const { result } = renderHook(() => useMediaQuery('(orientation: landscape)'));
            expect(result.current).toBe(false);
        });

        it('reports false when matchMedia throws on an unsupported query', () => {
            vi.stubGlobal('matchMedia', vi.fn(() => { throw new Error('bad query'); }));
            const { result } = renderHook(() => useMediaQuery('(unsupported: yes)'));
            expect(result.current).toBe(false);
        });

        it('subscribes and unsubscribes without throwing on a legacy list', () => {
            // Older Safari exposes addListener but not addEventListener.
            vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true, addListener: vi.fn() })));

            const { result, unmount } = renderHook(() => useMediaQuery('(orientation: landscape)'));

            expect(result.current).toBe(true);
            expect(() => unmount()).not.toThrow();
        });
    });
});
