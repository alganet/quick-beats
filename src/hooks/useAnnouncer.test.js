// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAnnouncer } from './useAnnouncer';

describe('useAnnouncer', () => {
    it('starts with empty regions', () => {
        const { result } = renderHook(() => useAnnouncer());
        expect(result.current.polite).toBe('');
        expect(result.current.assertive).toBe('');
    });

    it('announce sets the polite region only', () => {
        const { result } = renderHook(() => useAnnouncer());
        act(() => result.current.announce('Red Zeppelin ready'));
        expect(result.current.polite).toBe('Red Zeppelin ready');
        expect(result.current.assertive).toBe('');
    });

    it('announceError sets the assertive region only', () => {
        const { result } = renderHook(() => useAnnouncer());
        act(() => result.current.announceError('Could not load kit'));
        expect(result.current.assertive).toBe('Could not load kit');
        expect(result.current.polite).toBe('');
    });

    it('coerces a nullish message to empty string', () => {
        const { result } = renderHook(() => useAnnouncer());
        act(() => result.current.announce(undefined));
        expect(result.current.polite).toBe('');
    });

    it('keeps stable callback identities across renders', () => {
        const { result, rerender } = renderHook(() => useAnnouncer());
        const first = result.current.announce;
        rerender();
        expect(result.current.announce).toBe(first);
    });

    it('re-announces an identical consecutive message', () => {
        // A live region only speaks on a DOM change; the same text twice must
        // still mutate the region (deleting "Measure 1" twice in a row, say).
        const { result } = renderHook(() => useAnnouncer());
        act(() => result.current.announce('Measure 1 removed'));
        const first = result.current.polite;
        act(() => result.current.announce('Measure 1 removed'));
        expect(result.current.polite).not.toBe(first);
        expect(result.current.polite).toBe('Measure 1 removed ');

        // And a third repeat flips back — every repeat is a fresh mutation.
        act(() => result.current.announce('Measure 1 removed'));
        expect(result.current.polite).toBe('Measure 1 removed');
    });

    it('re-announces an identical consecutive error', () => {
        const { result } = renderHook(() => useAnnouncer());
        act(() => result.current.announceError('Humanize failed'));
        act(() => result.current.announceError('Humanize failed'));
        expect(result.current.assertive).toBe('Humanize failed ');
    });
});
