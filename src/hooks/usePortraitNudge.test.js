// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { usePortraitNudge } from './usePortraitNudge';

const DISMISS_KEY = 'qb-portrait-nudge';
let origMatchMedia;
let listeners;
let mediaMatches;

/** @param matches whether the "cramped portrait phone" query matches. */
function mockMedia(matches) {
    mediaMatches = matches;
    listeners = new Set();
    window.matchMedia = vi.fn().mockImplementation((media) => ({
        // A real MediaQueryList is live rather than a snapshot, so this has to be
        // a getter — consumers re-read it instead of trusting the event payload.
        get matches() { return mediaMatches; },
        media,
        addEventListener: (_event, fn) => listeners.add(fn),
        removeEventListener: (_event, fn) => listeners.delete(fn),
    }));
}

/** Simulates the user turning the device. */
function emitChange(matches) {
    // Real MediaQueryLists update matches before dispatching change.
    mediaMatches = matches;
    listeners.forEach(fn => fn({ matches }));
}

beforeEach(() => {
    origMatchMedia = window.matchMedia;
    localStorage.clear();
    mockMedia(true);
});

afterEach(() => {
    window.matchMedia = origMatchMedia;
    localStorage.clear();
    vi.clearAllMocks();
});

describe('usePortraitNudge', () => {
    it('is visible on a cramped portrait phone', () => {
        const { result } = renderHook(() => usePortraitNudge());
        expect(result.current.visible).toBe(true);
    });

    it('queries for portrait, coarse pointer, and a narrow viewport together', () => {
        renderHook(() => usePortraitNudge());
        const query = window.matchMedia.mock.calls[0][0];
        expect(query).toContain('(orientation: portrait)');
        expect(query).toContain('(pointer: coarse)');
        // Reuses the grid's own mobile breakpoint so the two can't drift apart.
        expect(query).toContain('max-width: 767.98px');
    });

    it('stays hidden where the query does not match, such as desktop or a tablet', () => {
        mockMedia(false);
        const { result } = renderHook(() => usePortraitNudge());
        expect(result.current.visible).toBe(false);
    });

    it('stays hidden once previously dismissed', () => {
        localStorage.setItem(DISMISS_KEY, '1');
        const { result } = renderHook(() => usePortraitNudge());
        expect(result.current.visible).toBe(false);
    });

    it('persists the dismissal so it survives a reload', () => {
        const { result } = renderHook(() => usePortraitNudge());
        act(() => { result.current.dismiss(); });

        expect(result.current.visible).toBe(false);
        expect(localStorage.getItem(DISMISS_KEY)).toBe('1');
    });

    it('hides itself when the device is rotated to landscape', () => {
        const { result } = renderHook(() => usePortraitNudge());
        expect(result.current.visible).toBe(true);

        act(() => { emitChange(false); });
        expect(result.current.visible).toBe(false);
    });

    it('survives localStorage being unavailable in private mode', () => {
        const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('QuotaExceededError');
        });
        const { result } = renderHook(() => usePortraitNudge());

        expect(() => act(() => { result.current.dismiss(); })).not.toThrow();
        expect(result.current.visible).toBe(false);
        spy.mockRestore();
    });
});
