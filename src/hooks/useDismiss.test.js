// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useDismiss } from './useDismiss';

describe('useDismiss', () => {
    let wrapper;
    let outside;
    let ref;

    beforeEach(() => {
        wrapper = document.createElement('div');
        wrapper.appendChild(document.createElement('button'));
        outside = document.createElement('div');
        document.body.append(wrapper, outside);
        ref = { current: wrapper };
    });

    afterEach(() => {
        document.body.replaceChildren();
        vi.restoreAllMocks();
    });

    const press = (key) => document.dispatchEvent(new KeyboardEvent('keydown', { key }));
    const mousedownOn = (node) => node.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

    it('closes on Escape', () => {
        const onClose = vi.fn();
        renderHook(() => useDismiss(true, ref, onClose));

        press('Escape');

        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('ignores other keys', () => {
        const onClose = vi.fn();
        renderHook(() => useDismiss(true, ref, onClose));

        press('Enter');
        press('a');
        press('Tab');

        expect(onClose).not.toHaveBeenCalled();
    });

    it('closes on a mousedown outside the wrapper', () => {
        const onClose = vi.fn();
        renderHook(() => useDismiss(true, ref, onClose));

        mousedownOn(outside);

        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('stays open on a mousedown inside the wrapper', () => {
        // The popover's own trigger and controls live inside; treating those as
        // outside clicks would close it the instant it was interacted with.
        const onClose = vi.fn();
        renderHook(() => useDismiss(true, ref, onClose));

        mousedownOn(wrapper.firstChild);

        expect(onClose).not.toHaveBeenCalled();
    });

    it('does not throw when the ref has not attached yet', () => {
        const onClose = vi.fn();
        renderHook(() => useDismiss(true, { current: null }, onClose));

        expect(() => mousedownOn(outside)).not.toThrow();
        expect(onClose).not.toHaveBeenCalled();
    });

    describe('subscription lifecycle', () => {
        it('registers no listeners while closed', () => {
            const add = vi.spyOn(document, 'addEventListener');
            renderHook(() => useDismiss(false, ref, vi.fn()));
            expect(add).not.toHaveBeenCalled();
        });

        it('removes both listeners on unmount', () => {
            const onClose = vi.fn();
            const { unmount } = renderHook(() => useDismiss(true, ref, onClose));

            unmount();
            press('Escape');
            mousedownOn(outside);

            expect(onClose).not.toHaveBeenCalled();
        });

        it('removes both listeners when it closes', () => {
            const onClose = vi.fn();
            const { rerender } = renderHook(({ open }) => useDismiss(open, ref, onClose), {
                initialProps: { open: true },
            });

            rerender({ open: false });
            press('Escape');

            expect(onClose).not.toHaveBeenCalled();
        });

        it('does not re-subscribe when given a fresh onClose each render', () => {
            // The whole reason onClose is held in a ref. Callers pass inline
            // arrows, so depending on it directly would tear down and re-attach
            // both document listeners on every single render of the parent.
            const add = vi.spyOn(document, 'addEventListener');
            const { rerender } = renderHook(({ onClose }) => useDismiss(true, ref, onClose), {
                initialProps: { onClose: vi.fn() },
            });
            const afterMount = add.mock.calls.length;

            rerender({ onClose: vi.fn() });
            rerender({ onClose: vi.fn() });
            const latest = vi.fn();
            rerender({ onClose: latest });

            expect(add.mock.calls.length).toBe(afterMount);
            // ...and the listener still standing calls the newest closure, not
            // the one captured at subscribe time.
            press('Escape');
            expect(latest).toHaveBeenCalledTimes(1);
        });
    });
});
