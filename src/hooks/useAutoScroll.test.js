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
});
