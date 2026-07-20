// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTheme } from './useTheme';

describe('useTheme', () => {
    beforeEach(() => {
        document.documentElement.removeAttribute('data-theme');
        document.documentElement.style.colorScheme = '';
        localStorage.removeItem('qb-theme');
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        document.querySelector('meta[name="theme-color"]')?.remove();
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

    it('seeds from a persisted qb-theme choice', () => {
        localStorage.setItem('qb-theme', 'light');
        const { result } = renderHook(() => useTheme());
        expect(result.current[0]).toBe('light');
    });

    it('ignores an invalid persisted value', () => {
        localStorage.setItem('qb-theme', 'solarized');
        const { result } = renderHook(() => useTheme());
        expect(result.current[0]).toBe('dark');
    });

    it('seeds from prefers-color-scheme when nothing is persisted', () => {
        vi.stubGlobal('matchMedia', vi.fn((query) => ({
            matches: query === '(prefers-color-scheme: light)',
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
        })));
        const { result } = renderHook(() => useTheme());
        expect(result.current[0]).toBe('light');
    });

    it('lets a persisted choice win over the OS preference', () => {
        localStorage.setItem('qb-theme', 'dark');
        vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));
        const { result } = renderHook(() => useTheme());
        expect(result.current[0]).toBe('dark');
    });

    it('persists on toggle but not on seed', () => {
        const { result } = renderHook(() => useTheme());
        // Merely mounting must not freeze the default — an untouched user
        // keeps following their OS setting.
        expect(localStorage.getItem('qb-theme')).toBeNull();

        act(() => {
            result.current[2](); // toggleTheme
        });
        expect(localStorage.getItem('qb-theme')).toBe('light');
    });

    it('syncs color-scheme and the theme-color meta with the theme', () => {
        const meta = document.createElement('meta');
        meta.setAttribute('name', 'theme-color');
        meta.setAttribute('content', '#141414');
        document.head.appendChild(meta);

        const { result } = renderHook(() => useTheme());
        expect(document.documentElement.style.colorScheme).toBe('dark');
        expect(meta.getAttribute('content')).toBe('#141414');

        act(() => {
            result.current[2](); // toggleTheme
        });
        expect(document.documentElement.style.colorScheme).toBe('light');
        expect(meta.getAttribute('content')).toBe('#f1f5f9');
    });
});
