// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { describe, it, expect } from 'vitest';
import { INSTRUMENTS } from '../data/kit';
import { DEFAULT_ZOOM } from '../data/sequencerConfig';
import { fitZoom, gridContentHeightPx } from './sequencerGeometry';

// Deliberately not mocking sequencerConfig: the whole worth of these numbers is
// that they reproduce what the browser actually lays out, so they are asserted
// against real ZOOM_CONFIG values and against heights measured from a running
// page. If the DOM and this math ever drift apart, that is the bug.
const ROWS = 7;

describe('gridContentHeightPx', () => {
    // Ground truth, measured via CDP against the real page. The reported
    // scrollHeight runs 13px under these on a desktop-width viewport because
    // SequencerHeader flex-shrinks from 32px to ~19px once the column overflows;
    // this function reports the natural height, before that squash.
    it.each([
        // zoom, measures, mobile, expected  (measured scrollHeight + header squash)
        [1, 2, false, 371], // browser: 358 + (32-19)
        [2, 2, false, 431], // browser: 418 + 13
        [1, 1, false, 328], // browser: 315 + 13
        [2, 1, false, 384], // browser: 371 + 13
        [0, 2, true, 273],  // browser (568w): 268 + (24-19)
    ])('zoom %i with %i measure(s), mobile=%s -> %ipx', (zoom, measureCount, mobile, expected) => {
        expect(gridContentHeightPx({ zoom, rowCount: ROWS, measureCount, mobile })).toBe(expected);
    });

    it('fits within the grid viewport at zoom 0 on a landscape phone', () => {
        // 844x390 leaves 304px once the compressed chrome is taken out.
        expect(gridContentHeightPx({ zoom: 0, rowCount: ROWS, measureCount: 2, mobile: false }))
            .toBeLessThanOrEqual(304);
    });

    it('leaves the delete bar out when there is only one measure to delete', () => {
        const withBar = gridContentHeightPx({ zoom: 1, rowCount: ROWS, measureCount: 2, mobile: false });
        const without = gridContentHeightPx({ zoom: 1, rowCount: ROWS, measureCount: 1, mobile: false });
        expect(withBar - without).toBe(43); // groupGap 12 + bar 31
    });

    it('grows with the row count', () => {
        const seven = gridContentHeightPx({ zoom: 1, rowCount: 7, measureCount: 1, mobile: false });
        const eight = gridContentHeightPx({ zoom: 1, rowCount: 8, measureCount: 1, mobile: false });
        expect(eight - seven).toBe(40); // one cellHeight at zoom 1
    });

    it('covers every instrument the kit ships', () => {
        expect(INSTRUMENTS.length).toBe(ROWS);
    });
});

describe('fitZoom', () => {
    const fit = (availableHeightPx, measureCount = 2, mobile = false) =>
        fitZoom({ availableHeightPx, rowCount: ROWS, measureCount, mobile });

    it('drops to zoom 0 on a landscape phone, where the default does not fit', () => {
        // 844x390 -> 304px available; zoom 1 wants 371.
        expect(fit(304)).toBe(0);
    });

    it('keeps the default when it fits', () => {
        expect(fit(400)).toBe(DEFAULT_ZOOM);
    });

    it('never exceeds the default, however tall the screen', () => {
        // Growing the pads would cost horizontal steps; this exists to rescue a
        // grid that does not fit, not to inflate one that already does.
        expect(fit(2000)).toBe(DEFAULT_ZOOM);
        expect(fit(754)).toBe(DEFAULT_ZOOM); // a portrait phone
    });

    it('falls back to the smallest zoom when nothing fits', () => {
        expect(fit(50)).toBe(0);
    });

    it('accounts for the delete bar, which can tip a borderline fit', () => {
        // 328 fits zoom 1 with one measure, but two measures need 371.
        expect(fit(328, 1)).toBe(DEFAULT_ZOOM);
        expect(fit(328, 2)).toBe(0);
    });

    it('allows a larger ceiling when asked', () => {
        expect(fitZoom({ availableHeightPx: 2000, rowCount: ROWS, measureCount: 2, mobile: false, maxZoom: 2 })).toBe(2);
    });

    it('never fits below minZoom, even when nothing fits (coarse pointers)', () => {
        // Zoom 0's 20px pads are under the 24px WCAG 2.5.8 floor; a touch
        // device passes minZoom 1 and gets a scrolling grid instead.
        expect(fitZoom({ availableHeightPx: 304, rowCount: ROWS, measureCount: 2, mobile: false, minZoom: 1 })).toBe(1);
        expect(fitZoom({ availableHeightPx: 50, rowCount: ROWS, measureCount: 2, mobile: false, minZoom: 1 })).toBe(1);
    });
});
