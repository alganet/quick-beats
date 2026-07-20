// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { DEFAULT_ZOOM, ZOOM_CONFIG } from '../data/sequencerConfig';

export const GRID_LAYOUT = {
    rowLabelClass: 'pl-1.5 w-8 md:w-10',
    rowLaneClass: 'ml-1 p-0.5 md:p-1',
    headerOffsetClass: 'ml-9.5 md:ml-12',
    controlsSpacerClass: 'w-9.5 md:w-11',
    playheadOffsetClass: 'ml-9.5 md:ml-12',
    mobileBreakpoint: 768,
    mobile: {
        labelWidth: 32,
        laneMarginLeft: 4,
        lanePaddingLeft: 2,
    },
    desktop: {
        labelWidth: 40,
        laneMarginLeft: 4,
        lanePaddingLeft: 4,
    }
};

export function isMobileViewport() {
    return typeof window !== 'undefined' && window.innerWidth < GRID_LAYOUT.mobileBreakpoint;
}

export function getGridOriginOffsetPx(mobile = isMobileViewport()) {
    const viewport = mobile ? GRID_LAYOUT.mobile : GRID_LAYOUT.desktop;
    return viewport.labelWidth + viewport.laneMarginLeft + viewport.lanePaddingLeft;
}

function getConfig(zoom) {
    return ZOOM_CONFIG[zoom] || ZOOM_CONFIG[1];
}

/**
 * Vertical counterparts to the width constants above. These mirror the DOM in
 * Sequencer and MeasureControls, so they have to move together:
 *
 *   SequencerHeader (h-6 / md:h-8)
 *   grid            rowCount × cellHeight
 *   MeasureControls groupGap + its own height, only when a measure is deletable
 *   the column's mb-4
 *
 * Checked against the measured scrollHeight at every zoom, viewport and measure
 * count: header + column + bottom margin equals it exactly.
 */
export const ROW_LAYOUT = {
    headerHeight: { mobile: 24, desktop: 32 },
    // Split because both halves are rendered from here: MeasureControls sizes
    // its bar to measureBarPx, and the border it draws above sits outside that
    // box. Kept apart rather than summed so neither consumer has to re-derive
    // the other's share — the sum is measureBarHeightPx below.
    measureBarPx: 30,
    measureBarBorderPx: 1,
    gridBottomMarginPx: 16,
};

export const measureBarHeightPx = ROW_LAYOUT.measureBarPx + ROW_LAYOUT.measureBarBorderPx;

/**
 * Natural height of the grid at a zoom — what it wants, before any shrinking.
 * SequencerHeader is a flex item that compresses to ~19px once the column
 * overflows, so the real rendered height can come in under this. Reporting the
 * un-squashed height keeps callers conservative: a zoom only "fits" if it fits
 * without crushing the beat numbers.
 */
export function gridContentHeightPx({ zoom, rowCount, measureCount, mobile = isMobileViewport() }) {
    const config = getConfig(zoom);
    const header = mobile ? ROW_LAYOUT.headerHeight.mobile : ROW_LAYOUT.headerHeight.desktop;
    const bar = measureCount > 1 ? config.groupGap + measureBarHeightPx : 0;
    return header + rowCount * config.cellHeight + bar + ROW_LAYOUT.gridBottomMarginPx;
}

/**
 * The largest zoom no bigger than `maxZoom` whose grid fits `availableHeightPx`,
 * falling back to `minZoom` when nothing does.
 *
 * Deliberately never returns more than `maxZoom`: this exists to rescue a grid
 * that does not fit, not to inflate one that already does. Growing the pads on a
 * tall screen would also cost horizontal steps, which nobody asked for.
 *
 * `minZoom` exists for coarse pointers, where zoom 0's 20px pads sit under the
 * 24px WCAG 2.5.8 minimum target size — better a grid that scrolls than pads a
 * finger cannot hit.
 */
export function fitZoom({ availableHeightPx, rowCount, measureCount, mobile, maxZoom = DEFAULT_ZOOM, minZoom = 0 }) {
    for (let zoom = maxZoom; zoom > minZoom; zoom--) {
        if (gridContentHeightPx({ zoom, rowCount, measureCount, mobile }) <= availableHeightPx) return zoom;
    }
    return minZoom;
}

export function stepToX(step, grouping, zoom) {
    const safeGrouping = Math.max(1, grouping || 1);
    const config = getConfig(zoom);
    const safeStep = Math.max(0, step);
    return safeStep * (config.cellWidth + config.gap) + Math.floor(safeStep / safeGrouping) * config.groupGap;
}

export function sequenceWidth(stepCount, grouping, zoom) {
    return stepToX(stepCount, grouping, zoom);
}

export function measureWidth(stepsPerMeasure, grouping, zoom) {
    const safeGrouping = Math.max(1, grouping || 1);
    const config = getConfig(zoom);
    const groupsInMeasure = Math.floor(stepsPerMeasure / safeGrouping);
    return stepsPerMeasure * (config.cellWidth + config.gap) + Math.max(0, groupsInMeasure - 1) * config.groupGap;
}

// Scroll offset needed to bring `step` into view, centered, or null if it is
// already within the viewport. Mirrors the visible-range math in Sequencer
// (content-x compared against [scrollLeft - origin, scrollLeft + width - origin])
// and the playhead's centering. Used for keyboard focus-into-view.
export function scrollTargetForStep(step, scrollLeft, containerWidth, gridOriginOffset, grouping, zoom) {
    const x = stepToX(step, grouping, zoom);
    const viewLeft = scrollLeft - gridOriginOffset;
    const viewRight = scrollLeft + containerWidth - gridOriginOffset;
    if (x >= viewLeft && x <= viewRight) return null; // already visible
    return Math.max(0, Math.round(x + gridOriginOffset - containerWidth / 2));
}

export function xToStep(x, stepCount, grouping, zoom) {
    const safeStepCount = Math.max(1, stepCount || 1);
    const maxStep = safeStepCount - 1;
    if (x <= 0) return 0;

    const maxX = stepToX(maxStep, grouping, zoom);
    if (x >= maxX) return maxStep;

    let low = 0;
    let high = maxStep;
    let answer = 0;

    while (low <= high) {
        const middle = Math.floor((low + high) / 2);
        const position = stepToX(middle, grouping, zoom);
        if (position <= x) {
            answer = middle;
            low = middle + 1;
        } else {
            high = middle - 1;
        }
    }

    return answer;
}
