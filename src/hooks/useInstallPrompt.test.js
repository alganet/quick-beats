// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useInstallPrompt } from './useInstallPrompt';

const makeBip = () => Object.assign(new Event('beforeinstallprompt'), {
    prompt: vi.fn().mockResolvedValue(undefined),
    userChoice: Promise.resolve({ outcome: 'accepted' }),
});

const setNavProp = (key, value) => {
    const had = Object.prototype.hasOwnProperty.call(navigator, key);
    const orig = navigator[key];
    Object.defineProperty(navigator, key, { value, configurable: true });
    return () => {
        if (had) Object.defineProperty(navigator, key, { value: orig, configurable: true });
        else delete navigator[key];
    };
};

describe('useInstallPrompt', () => {
    afterEach(() => { vi.unstubAllGlobals(); });

    it('is not installable until the browser offers a prompt', () => {
        const { result } = renderHook(() => useInstallPrompt());
        expect(result.current.canInstall).toBe(false);
    });

    it('captures beforeinstallprompt, prevents the default banner, and becomes installable', () => {
        const { result } = renderHook(() => useInstallPrompt());
        const e = makeBip();
        const prevent = vi.spyOn(e, 'preventDefault');
        act(() => { window.dispatchEvent(e); });
        expect(prevent).toHaveBeenCalled();
        expect(result.current.canInstall).toBe(true);
    });

    it('promptInstall triggers the stashed prompt and hides the affordance', async () => {
        const { result } = renderHook(() => useInstallPrompt());
        const e = makeBip();
        act(() => { window.dispatchEvent(e); });
        await act(async () => { await result.current.promptInstall(); });
        expect(e.prompt).toHaveBeenCalledTimes(1);
        expect(result.current.canInstall).toBe(false);
    });

    it('appinstalled clears the affordance and fires onInstalled', () => {
        const onInstalled = vi.fn();
        const { result } = renderHook(() => useInstallPrompt({ onInstalled }));
        act(() => { window.dispatchEvent(makeBip()); });
        expect(result.current.canInstall).toBe(true);
        act(() => { window.dispatchEvent(new Event('appinstalled')); });
        expect(result.current.canInstall).toBe(false);
        expect(onInstalled).toHaveBeenCalledTimes(1);
    });

    it('reports standalone from display-mode: standalone', () => {
        vi.stubGlobal('matchMedia', vi.fn((q) => ({
            matches: q === '(display-mode: standalone)',
            addEventListener: vi.fn(), removeEventListener: vi.fn(),
        })));
        const { result } = renderHook(() => useInstallPrompt());
        expect(result.current.isStandalone).toBe(true);
    });

    it('reports standalone from navigator.standalone (iOS home-screen launch)', () => {
        const restore = setNavProp('standalone', true);
        const { result } = renderHook(() => useInstallPrompt());
        expect(result.current.isStandalone).toBe(true);
        restore();
    });

    it('detects iOS from the user agent', () => {
        const restore = setNavProp('userAgent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)');
        const { result } = renderHook(() => useInstallPrompt());
        expect(result.current.isIOS).toBe(true);
        restore();
    });

    it('is not iOS on a plain desktop user agent', () => {
        const { result } = renderHook(() => useInstallPrompt());
        expect(result.current.isIOS).toBe(false);
    });

    it('removes its listeners on unmount', () => {
        // result.current freezes after unmount, so asserting on it would pass
        // regardless — spy on the actual removal instead.
        const removeSpy = vi.spyOn(window, 'removeEventListener');
        const { unmount } = renderHook(() => useInstallPrompt());
        unmount();
        const removed = removeSpy.mock.calls.map(([type]) => type);
        expect(removed).toContain('beforeinstallprompt');
        expect(removed).toContain('appinstalled');
        removeSpy.mockRestore();
    });
});
