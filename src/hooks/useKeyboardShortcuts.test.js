// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';

const ACTION_DELAY_MS = 200;

function press(key, { code, target } = {}) {
    const event = new KeyboardEvent('keydown', { key, code, cancelable: true });
    if (target) Object.defineProperty(event, 'target', { value: target });
    window.dispatchEvent(event);
    return event;
}

describe('useKeyboardShortcuts', () => {
    let handlers;

    beforeEach(() => {
        vi.useFakeTimers();
        handlers = {
            togglePlay: vi.fn(),
            setBpmInput: vi.fn(),
            setZoom: vi.fn(),
            setAutoScroll: vi.fn(),
            openHelp: vi.fn(),
            onCloseOverlay: vi.fn(),
            humanizeAction: vi.fn(),
        };
    });

    afterEach(() => {
        vi.runOnlyPendingTimers();
        vi.useRealTimers();
    });

    const mount = () => renderHook(() => useKeyboardShortcuts(handlers));

    it('Space toggles play and prevents default', () => {
        mount();
        const event = press(' ', { code: 'Space' });
        expect(handlers.togglePlay).toHaveBeenCalledTimes(1);
        expect(event.defaultPrevented).toBe(true);
    });

    it('p toggles play (single-key alternative to Space)', () => {
        mount();
        press('p');
        expect(handlers.togglePlay).toHaveBeenCalledTimes(1);
    });

    it('p is disabled with the rest of the single-key shortcuts', () => {
        renderHook(() => useKeyboardShortcuts({ ...handlers, singleKeyEnabled: false }));
        press('p');
        expect(handlers.togglePlay).not.toHaveBeenCalled();
    });

    it('? opens help', () => {
        mount();
        press('?');
        expect(handlers.openHelp).toHaveBeenCalledTimes(1);
    });

    it('- decrements BPM, clamped at 60', () => {
        mount();
        press('-');
        const updater = handlers.setBpmInput.mock.calls[0][0];
        expect(updater(100)).toBe(99);
        expect(updater(60)).toBe(60);
    });

    it('= increments BPM, clamped at 240', () => {
        mount();
        press('=');
        const updater = handlers.setBpmInput.mock.calls[0][0];
        expect(updater(100)).toBe(101);
        expect(updater(240)).toBe(240);
    });

    it('z cycles zoom after the debounce delay', () => {
        mount();
        press('z');
        expect(handlers.setZoom).not.toHaveBeenCalled();
        vi.advanceTimersByTime(ACTION_DELAY_MS);
        const updater = handlers.setZoom.mock.calls[0][0];
        expect(updater(0)).toBe(1);
        expect(updater(2)).toBe(0);
    });

    it('s toggles auto-scroll after the debounce delay', () => {
        mount();
        press('s');
        expect(handlers.setAutoScroll).not.toHaveBeenCalled();
        vi.advanceTimersByTime(ACTION_DELAY_MS);
        const updater = handlers.setAutoScroll.mock.calls[0][0];
        expect(updater(true)).toBe(false);
    });

    it('repeated z presses debounce into a single toggle', () => {
        mount();
        press('z');
        press('z');
        press('z');
        vi.advanceTimersByTime(ACTION_DELAY_MS);
        expect(handlers.setZoom).toHaveBeenCalledTimes(1);
    });

    it('h triggers the humanize action', () => {
        mount();
        press('h');
        expect(handlers.humanizeAction).toHaveBeenCalledTimes(1);
    });

    it('Escape routes through the shared close-overlay path', () => {
        mount();
        press('Escape');
        expect(handlers.onCloseOverlay).toHaveBeenCalledTimes(1);
    });

    it('ignores keys while typing in form controls', () => {
        mount();
        press(' ', { code: 'Space', target: { tagName: 'INPUT' } });
        press('h', { target: { tagName: 'TEXTAREA' } });
        press('?', { target: { tagName: 'SELECT' } });
        expect(handlers.togglePlay).not.toHaveBeenCalled();
        expect(handlers.humanizeAction).not.toHaveBeenCalled();
        expect(handlers.openHelp).not.toHaveBeenCalled();
    });

    it('+ also increments BPM (tooltip documents it)', () => {
        mount();
        press('+');
        const updater = handlers.setBpmInput.mock.calls[0][0];
        expect(updater(100)).toBe(101);
    });

    it('ignores modifier combos so browser shortcuts survive', () => {
        mount();
        for (const mod of [{ ctrlKey: true }, { metaKey: true }, { altKey: true }]) {
            const event = new KeyboardEvent('keydown', { key: 's', cancelable: true, ...mod });
            window.dispatchEvent(event);
            const zEvent = new KeyboardEvent('keydown', { key: 'z', cancelable: true, ...mod });
            window.dispatchEvent(zEvent);
        }
        vi.advanceTimersByTime(ACTION_DELAY_MS);
        expect(handlers.setAutoScroll).not.toHaveBeenCalled();
        expect(handlers.setZoom).not.toHaveBeenCalled();
    });

    it('lets Space through to a focused button instead of toggling play', () => {
        mount();
        const button = document.createElement('button');
        const event = press(' ', { code: 'Space', target: button });
        expect(handlers.togglePlay).not.toHaveBeenCalled();
        expect(event.defaultPrevented).toBe(false);
    });

    it('ignores keys while typing in contenteditable', () => {
        mount();
        const editable = document.createElement('div');
        Object.defineProperty(editable, 'isContentEditable', { value: true });
        press('s', { target: editable });
        vi.advanceTimersByTime(ACTION_DELAY_MS);
        expect(handlers.setAutoScroll).not.toHaveBeenCalled();
    });

    it('singleKeyEnabled: false disables the character shortcuts but keeps Space and Escape', () => {
        renderHook(() => useKeyboardShortcuts({ ...handlers, singleKeyEnabled: false }));

        press('z');
        press('s');
        press('h');
        press('-');
        press('=');
        press('?');
        vi.advanceTimersByTime(ACTION_DELAY_MS);
        expect(handlers.setZoom).not.toHaveBeenCalled();
        expect(handlers.setAutoScroll).not.toHaveBeenCalled();
        expect(handlers.humanizeAction).not.toHaveBeenCalled();
        expect(handlers.setBpmInput).not.toHaveBeenCalled();
        expect(handlers.openHelp).not.toHaveBeenCalled();

        press(' ', { code: 'Space' });
        expect(handlers.togglePlay).toHaveBeenCalledTimes(1);
        press('Escape');
        expect(handlers.onCloseOverlay).toHaveBeenCalledTimes(1);
    });

    it('removes the keydown listener on unmount', () => {
        const { unmount } = mount();
        unmount();
        press(' ', { code: 'Space' });
        expect(handlers.togglePlay).not.toHaveBeenCalled();
    });

    it('clears a pending debounce timer on unmount', () => {
        const { unmount } = mount();
        press('z');
        unmount();
        vi.advanceTimersByTime(ACTION_DELAY_MS);
        expect(handlers.setZoom).not.toHaveBeenCalled();
    });
});
