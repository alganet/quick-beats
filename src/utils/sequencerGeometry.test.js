// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { describe, it, expect, vi } from 'vitest';

vi.mock('../data/sequencerConfig', () => ({
    ZOOM_CONFIG: {
        1: { cellWidth: 32, gap: 4, groupGap: 12 }
    }
}));

import {
    getGridOriginOffsetPx,
    isMobileViewport,
    measureWidth,
    scrollTargetForStep,
    sequenceWidth,
    stepToX,
    xToStep,
} from './sequencerGeometry';

describe('sequencerGeometry', () => {
    it('calculates exact step offsets with group gaps', () => {
        expect(stepToX(0, 4, 1)).toBe(0);
        expect(stepToX(3, 4, 1)).toBe(108);
        expect(stepToX(4, 4, 1)).toBe(156);
        expect(stepToX(8, 4, 1)).toBe(312);
    });

    it('calculates sequence and measure widths using shared math', () => {
        expect(sequenceWidth(16, 4, 1)).toBe(624);
        expect(measureWidth(16, 4, 1)).toBe(612);
    });

    it('maps x back to the exact step index at boundaries', () => {
        expect(xToStep(-10, 16, 4, 1)).toBe(0);
        expect(xToStep(0, 16, 4, 1)).toBe(0);
        expect(xToStep(155, 16, 4, 1)).toBe(3);
        expect(xToStep(156, 16, 4, 1)).toBe(4);
        expect(xToStep(311, 16, 4, 1)).toBe(7);
        expect(xToStep(9999, 16, 4, 1)).toBe(15);
    });

    it('uses shared mobile/desktop grid origin offsets', () => {
        expect(getGridOriginOffsetPx(true)).toBe(38);
        expect(getGridOriginOffsetPx(false)).toBe(48);
    });

    it('detects viewport mode from window width', () => {
        const originalWidth = window.innerWidth;
        Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 480 });
        expect(isMobileViewport()).toBe(true);

        Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 1024 });
        expect(isMobileViewport()).toBe(false);

        Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: originalWidth });
    });

    it('handles undefined or zero grouping values', () => {
        expect(stepToX(4, undefined, 1)).toBe(stepToX(4, 1, 1));
        expect(stepToX(4, 0, 1)).toBe(stepToX(4, 1, 1));
        expect(measureWidth(4, undefined, 1)).toBe(measureWidth(4, 1, 1));
        expect(measureWidth(4, 0, 1)).toBe(measureWidth(4, 1, 1));
    });

    it('handles negative step values', () => {
        expect(stepToX(-5, 4, 1)).toBe(0);
    });

    it('handles undefined or zero stepCount in xToStep', () => {
        expect(xToStep(100, undefined, 4, 1)).toBe(0);
        expect(xToStep(100, 0, 4, 1)).toBe(0);
    });

    it('handles measureWidth with steps smaller than grouping', () => {
        expect(measureWidth(2, 4, 1)).toBeGreaterThan(0);
        expect(measureWidth(4, 4, 1)).toBeGreaterThan(0);
    });

    it('falls back to default zoom config for unknown zoom levels', () => {
        expect(stepToX(4, 4, 999)).toBe(stepToX(4, 4, 1));
    });

    describe('scrollTargetForStep', () => {
        // origin 48, viewport 400 wide, grouping 4, zoom 1
        it('returns null when the step is already within the viewport', () => {
            expect(scrollTargetForStep(0, 0, 400, 48, 4, 1)).toBeNull();
            expect(scrollTargetForStep(5, 0, 400, 48, 4, 1)).toBeNull(); // x=192 within [-48,352]
        });

        it('centers a step that is off the right edge', () => {
            // step 20 -> x = 20*36 + 5*12 = 780, beyond viewRight (352)
            // target = round(780 + 48 - 200) = 628
            expect(scrollTargetForStep(20, 0, 400, 48, 4, 1)).toBe(628);
        });

        it('clamps to zero when centering a step near the start', () => {
            // scrolled to 600; step 0 (x=0) is off the left edge; centered target is negative -> 0
            expect(scrollTargetForStep(0, 600, 400, 48, 4, 1)).toBe(0);
        });
    });
});
