// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC


import { ZOOM_CONFIG } from '../data/sequencerConfig';
import { stepToX } from '../utils/sequencerGeometry';

export function PlayheadOverlay({
    currentStep,
    grouping,
    zoom,
    measureCount,
    gridOriginOffset,
}) {
    const config = ZOOM_CONFIG[zoom];
    const stepOffset = stepToX(currentStep, grouping, zoom);

    return (
        <div className="absolute inset-0 pointer-events-none flex flex-col border-none" style={{ marginLeft: `${gridOriginOffset ?? 48}px` }}>
            <div
                style={{ height: measureCount > 1 ? `calc(98.5% - 30px - 1.1rem)` : `calc(100% - 1.1rem)` }}
                className={`relative h-[calc(100%-${config.cellHeight}px)] p-0.5 md:p-1`}
            >
                <div
                    className="absolute top-0 bottom-0 w-[2px] left-0 bg-[#22d3ee] z-10"
                    style={{ transform: `translateX(${stepOffset}px)` }}
                    data-testid="playhead-indicator"
                    aria-hidden="true"
                />
            </div>
        </div>
    );
}
