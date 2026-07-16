// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC


import { ROW_LAYOUT, stepToX } from '../utils/sequencerGeometry';

export function PlayheadOverlay({
    currentStep,
    grouping,
    zoom,
    measureCount,
    gridOriginOffset,
}) {
    const stepOffset = stepToX(currentStep, grouping, zoom);

    return (
        <div className="absolute inset-0 pointer-events-none flex flex-col border-none" style={{ marginLeft: `${gridOriginOffset ?? 48}px` }}>
            {/* The height comes from the style below. An h-[calc(100%-Npx)] class
                used to sit here too, interpolated from config.cellHeight — which
                Tailwind's scanner cannot see, so it never emitted any CSS. An
                inline style has no such limit, so the measure bar's height is
                interpolated rather than restated. */}
            <div
                style={{ height: measureCount > 1 ? `calc(98.5% - ${ROW_LAYOUT.measureBarPx}px - 1.1rem)` : `calc(100% - 1.1rem)` }}
                className="relative p-0.5 md:p-1"
            >
                <div
                    className="absolute top-0 bottom-0 w-[2px] left-0 bg-accent z-10"
                    style={{ transform: `translateX(${stepOffset}px)` }}
                    data-testid="playhead-indicator"
                    aria-hidden="true"
                />
            </div>
        </div>
    );
}
