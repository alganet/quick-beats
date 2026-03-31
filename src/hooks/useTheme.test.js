// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTheme } from './useTheme';

describe('useTheme', () => {
    beforeEach(() => {
        document.documentElement.removeAttribute('data-theme');
    });

    it('defaults to dark theme', () => {
        const { result } = renderHook(() => useTheme());
        const [theme] = result.current;
        expect(theme).toBe('dark');
    });

    it('sets data-theme attribute on document element', () => {
        renderHook(() => useTheme());
        expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });

    it('toggles between dark and light', () => {
        const { result } = renderHook(() => useTheme());

        act(() => {
            result.current[2](); // toggleTheme
        });
        expect(result.current[0]).toBe('light');
        expect(document.documentElement.getAttribute('data-theme')).toBe('light');

        act(() => {
            result.current[2](); // toggleTheme
        });
        expect(result.current[0]).toBe('dark');
        expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });

    it('allows setting theme directly via setTheme', () => {
        const { result } = renderHook(() => useTheme());

        act(() => {
            result.current[1]('light'); // setTheme
        });
        expect(result.current[0]).toBe('light');

        act(() => {
            result.current[1]('dark');
        });
        expect(result.current[0]).toBe('dark');
    });
});
