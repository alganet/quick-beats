// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useAutoScroll } from './useAutoScroll';

// Mock config
vi.mock('../data/sequencerConfig', () => ({
    ZOOM_CONFIG: {
        1: { cellWidth: 32, gap: 4, groupGap: 8 }
    }
}));

describe('useAutoScroll', () => {
    let scrollContainerRef;
    let setAutoScroll;
    let setCanScroll;

    beforeEach(() => {
        // Mock scroll container
        scrollContainerRef = {
            current: {
                clientWidth: 800,
                scrollLeft: 0,
                scrollWidth: 2000,
                // Taller content than viewport: the grid overflows vertically,
                // so a vertical wheel has somewhere of its own to go. Tests that
                // care about the desktop case override these.
                clientHeight: 300,
                scrollHeight: 400,
                scrollTo: vi.fn(),
                querySelector: vi.fn().mockImplementation((sel) => {
                    if (sel === '.sticky') return { offsetWidth: 64 };
                    return null;
                })
            }
        };
        setAutoScroll = vi.fn();
        setCanScroll = vi.fn();

        // Mock ResizeObserver
        global.ResizeObserver = class {
            observe() {}
            unobserve() {}
            disconnect() {}
        };
        
        // Mock window.innerWidth
        Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('sets canScroll on mount', () => {
        renderHook(() => useAutoScroll({
            scrollContainerRef,
            currentStep: 0,
            stepCount: 16,
            grouping: 4,
            autoScroll: true,
            setAutoScroll,
            setCanScroll,
            zoom: 1,
            isPlaying: false
        }));

        expect(setCanScroll).toHaveBeenCalledWith(true);
    });

    it('scrolls when playhead moves off screen right', () => {
        const { rerender } = renderHook((props) => useAutoScroll(props), {
            initialProps: {
                scrollContainerRef,
                currentStep: 0,
                stepCount: 64,
                grouping: 4,
                autoScroll: true,
                setAutoScroll,
                setCanScroll,
                zoom: 1,
                isPlaying: true
            }
        });

        // Advance step to off-screen
        // Width 800. Cell 32+4=36. 
        // 800 / 36 ~= 22 steps visible.
        // Let's jump to step 30.
        
        rerender({
            scrollContainerRef,
            currentStep: 30,
            stepCount: 64,
            grouping: 4,
            autoScroll: true,
            setAutoScroll,
            setCanScroll,
            zoom: 1,
            isPlaying: true
        });

        expect(scrollContainerRef.current.scrollTo).toHaveBeenCalled();
        // Check args? 
        // We can just verify it was called.
    });

    it('does not scroll if autoScroll is false', () => {
        const { rerender } = renderHook((props) => useAutoScroll(props), {
            initialProps: {
                scrollContainerRef,
                currentStep: 0,
                stepCount: 64,
                grouping: 4,
                autoScroll: false,
                setAutoScroll,
                setCanScroll,
                zoom: 1,
                isPlaying: true
            }
        });

        rerender({
            scrollContainerRef,
            currentStep: 30,
            stepCount: 64,
            grouping: 4,
            autoScroll: false,
            setAutoScroll,
            setCanScroll,
            zoom: 1,
            isPlaying: true
        });

        expect(scrollContainerRef.current.scrollTo).not.toHaveBeenCalled();
    });

    const withAutoScroll = (autoScroll = true) => renderHook(() => useAutoScroll({
        scrollContainerRef,
        currentStep: 0,
        stepCount: 16,
        grouping: 4,
        autoScroll,
        setAutoScroll,
        setCanScroll,
        zoom: 1
    }));

    it('disables autoScroll when the user takes over the horizontal scroll', () => {
        const { result } = withAutoScroll();

        result.current.handleWheel({ deltaX: -40, deltaY: 0 });
        expect(setAutoScroll).toHaveBeenCalledWith(false);
    });

    it('keeps following when the user scrolls vertically', () => {
        // The grid scrolls both axes from one element, so a scroll down to reach
        // the lower rows or the delete bar must not read as "stop following".
        const { result } = withAutoScroll();

        result.current.handleWheel({ deltaX: 0, deltaY: 60 });
        expect(setAutoScroll).not.toHaveBeenCalled();
    });

    it('treats a vertical wheel as horizontal intent when nothing can scroll vertically', () => {
        // The desktop case: the grid fits vertically, so the browser spends a
        // plain mouse wheel's deltaY on scrollLeft. Trusting the label here
        // would leave the follow fighting the wheel that is moving the grid.
        scrollContainerRef.current.scrollHeight = 300;
        scrollContainerRef.current.clientHeight = 300;
        const { result } = withAutoScroll();

        result.current.handleWheel({ deltaX: 0, deltaY: 60 });
        expect(setAutoScroll).toHaveBeenCalledWith(false);
    });

    it('disables autoScroll on a horizontal drag', () => {
        const { result } = withAutoScroll();

        result.current.handleTouchStart({ touches: [{ clientX: 200, clientY: 100 }] });
        result.current.handleTouchMove({ touches: [{ clientX: 140, clientY: 108 }] });
        expect(setAutoScroll).toHaveBeenCalledWith(false);
    });

    it('keeps following through a vertical drag', () => {
        const { result } = withAutoScroll();

        result.current.handleTouchStart({ touches: [{ clientX: 200, clientY: 100 }] });
        result.current.handleTouchMove({ touches: [{ clientX: 206, clientY: 180 }] });
        expect(setAutoScroll).not.toHaveBeenCalled();
    });

    it('keeps following through the jitter of a stationary tap', () => {
        // A finger rolls a couple of pixels between touchstart and touchmove.
        // That is a tap on a pad, not a decision to stop following — even though
        // its 2px of x beats its 1px of y.
        const { result } = withAutoScroll();

        result.current.handleTouchStart({ touches: [{ clientX: 200, clientY: 100 }] });
        result.current.handleTouchMove({ touches: [{ clientX: 202, clientY: 101 }] });
        expect(setAutoScroll).not.toHaveBeenCalled();
    });

    it('ignores a touch move with no recorded origin', () => {
        const { result } = withAutoScroll();

        expect(() => result.current.handleTouchMove({ touches: [{ clientX: 10, clientY: 10 }] })).not.toThrow();
        expect(setAutoScroll).not.toHaveBeenCalled();
    });

    it('does not disable autoScroll when it is already off', () => {
        const { result } = withAutoScroll(false);

        result.current.handleWheel({ deltaX: -40, deltaY: 0 });
        expect(setAutoScroll).not.toHaveBeenCalled();
    });

    it('sets playheadOffLeft when playhead is before viewport', () => {
        const { rerender, result } = renderHook((props) => useAutoScroll(props), {
            initialProps: {
                scrollContainerRef,
                currentStep: 0,
                stepCount: 64,
                grouping: 4,
                autoScroll: false,
                setAutoScroll,
                setCanScroll,
                zoom: 1
            }
        });

        // Scroll container to position 200, which is > gridOriginOffset (48)
        scrollContainerRef.current.scrollLeft = 200;
        scrollContainerRef.current.clientWidth = 800;

        // change currentStep to force effect to run again
        rerender({
            scrollContainerRef,
            currentStep: 1,
            stepCount: 64,
            grouping: 4,
            autoScroll: false,
            setAutoScroll,
            setCanScroll,
            zoom: 1
        });

        // After rerender the second time, check the same hook's result
        expect(result.current.playheadOffLeft).toBe(true);
    });

    it('returns default values when container ref is null on mount', () => {
        const nullRef = { current: null };
        // Should not throw, just return defaults
        const { result } = renderHook(() => useAutoScroll({
            scrollContainerRef: nullRef,
            currentStep: 0,
            stepCount: 16,
            grouping: 4,
            autoScroll: true,
            setAutoScroll,
            setCanScroll,
            zoom: 1
        }));

        expect(result.current.playheadOffRight).toBe(false);
        expect(result.current.playheadOffLeft).toBe(false);
    });

    it('scrolls to left edge when playhead is off left and autoScroll is enabled', () => {
        const { rerender } = renderHook((props) => useAutoScroll(props), {
            initialProps: {
                scrollContainerRef,
                currentStep: 0,
                stepCount: 64,
                grouping: 4,
                autoScroll: true,
                setAutoScroll,
                setCanScroll,
                zoom: 1
            }
        });

        // Scroll to position far right
        scrollContainerRef.current.scrollLeft = 500;
        scrollContainerRef.current.clientWidth = 800;

        // Move to early step (off left)
        rerender({
            scrollContainerRef,
            currentStep: 1,
            stepCount: 64,
            grouping: 4,
            autoScroll: true,
            setAutoScroll,
            setCanScroll,
            zoom: 1
        });

        // Should scroll to left edge (0)
        expect(scrollContainerRef.current.scrollTo).toHaveBeenCalledWith({ left: 0, behavior: 'auto' });
    });
});
