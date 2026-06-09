// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useInputModality } from './useInputModality';

describe('useInputModality', () => {
    it('defaults to keyboard', () => {
        const { result } = renderHook(() => useInputModality());
        expect(result.current.current).toBe('keyboard');
    });

    it('switches to pointer on mousedown / pointerdown / touchstart', () => {
        const { result } = renderHook(() => useInputModality());
        document.dispatchEvent(new MouseEvent('mousedown'));
        expect(result.current.current).toBe('pointer');
    });

    it('switches back to keyboard on keydown', () => {
        const { result } = renderHook(() => useInputModality());
        document.dispatchEvent(new MouseEvent('mousedown'));
        expect(result.current.current).toBe('pointer');
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
        expect(result.current.current).toBe('keyboard');
    });

    it('stops tracking after unmount', () => {
        const { result, unmount } = renderHook(() => useInputModality());
        const ref = result.current;
        unmount();
        document.dispatchEvent(new MouseEvent('mousedown'));
        expect(ref.current).toBe('keyboard'); // listener removed, ref unchanged
    });
});
