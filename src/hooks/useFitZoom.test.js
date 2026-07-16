// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DEFAULT_ZOOM } from '../data/sequencerConfig';
import { useFitZoom } from './useFitZoom';

// jsdom reports clientHeight as 0 for every element, so the height has to be
// handed to the hook directly — which is also why App-level tests cannot reach
// this hook at all and it needs its own.
const ROWS = 7;

describe('useFitZoom', () => {
    let scrollContainerRef;
    let onFit;

    const mount = ({ enabled = true, measureCount = 2, clientHeight = 400 } = {}) => {
        scrollContainerRef.current = clientHeight === null ? null : { clientHeight };
        return renderHook(
            (props) => useFitZoom({ scrollContainerRef, onFit, rowCount: ROWS, ...props }),
            { initialProps: { enabled, measureCount } }
        );
    };

    beforeEach(() => {
        scrollContainerRef = { current: { clientHeight: 400 } };
        onFit = vi.fn();
        // Desktop width: fitZoom reads the viewport to pick the header height.
        Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 });
    });

    it('shrinks the zoom to fit a grid viewport the default overflows', () => {
        // A landscape phone leaves 304px; the grid wants 371 at the default.
        mount({ clientHeight: 304 });
        expect(onFit).toHaveBeenCalledWith(0);
    });

    it('keeps the default when the grid already fits', () => {
        mount({ clientHeight: 800 });
        expect(onFit).toHaveBeenCalledWith(DEFAULT_ZOOM);
    });

    it('does not fit at all once the user has chosen a zoom', () => {
        mount({ enabled: false, clientHeight: 304 });
        expect(onFit).not.toHaveBeenCalled();
    });

    it('waits rather than fitting to a height that is not laid out yet', () => {
        // Fitting to 0 would pin the grid at the smallest zoom for the session,
        // since nothing measures again unless the window resizes.
        mount({ clientHeight: 0 });
        expect(onFit).not.toHaveBeenCalled();
    });

    it('does not fit when there is no container', () => {
        mount({ clientHeight: null });
        expect(onFit).not.toHaveBeenCalled();
    });

    it('re-fits when the window resizes', () => {
        mount({ clientHeight: 800 });
        expect(onFit).toHaveBeenCalledWith(DEFAULT_ZOOM);

        scrollContainerRef.current.clientHeight = 304;
        act(() => { window.dispatchEvent(new Event('resize')); });
        expect(onFit).toHaveBeenLastCalledWith(0);
    });

    it('re-fits when the device rotates', () => {
        mount({ clientHeight: 800 });

        scrollContainerRef.current.clientHeight = 304;
        act(() => { window.dispatchEvent(new Event('orientationchange')); });
        expect(onFit).toHaveBeenLastCalledWith(0);
    });

    it('re-fits when a measure is added, which can tip a borderline fit', () => {
        // 328 fits the default with one measure; a second one needs 371.
        const { rerender } = mount({ clientHeight: 328, measureCount: 1 });
        expect(onFit).toHaveBeenCalledWith(DEFAULT_ZOOM);

        rerender({ enabled: true, measureCount: 2 });
        expect(onFit).toHaveBeenLastCalledWith(0);
    });

    it('stops measuring the moment the user picks a zoom', () => {
        const { rerender } = mount({ clientHeight: 800 });
        onFit.mockClear();

        rerender({ enabled: false, measureCount: 2 });
        scrollContainerRef.current.clientHeight = 304;
        act(() => { window.dispatchEvent(new Event('resize')); });

        expect(onFit).not.toHaveBeenCalled();
    });

    it('leaves no listener behind on unmount', () => {
        const { unmount } = mount({ clientHeight: 800 });
        onFit.mockClear();

        unmount();
        act(() => { window.dispatchEvent(new Event('resize')); });

        expect(onFit).not.toHaveBeenCalled();
    });
});
