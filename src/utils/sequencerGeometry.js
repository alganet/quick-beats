// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { ZOOM_CONFIG } from '../data/sequencerConfig';

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
