// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC


import { ZOOM_CONFIG } from '../data/sequencerConfig';
import { measureWidth, ROW_LAYOUT } from '../utils/sequencerGeometry';
import ConfirmBar from './ConfirmBar';

const getHorizontalScrollContainer = (element) => {
    if (!element) return null;
    return element.closest('[data-sequencer-scroll-container="true"]') ?? element.closest('.overflow-x-auto');
};

const centerMeasureInView = (measureElement) => {
    const scrollContainer = getHorizontalScrollContainer(measureElement);
    if (!scrollContainer || typeof scrollContainer.scrollTo !== 'function') return;

    const containerRect = scrollContainer.getBoundingClientRect();
    const measureRect = measureElement.getBoundingClientRect();
    const targetScrollLeft = scrollContainer.scrollLeft
        + (measureRect.left - containerRect.left)
        - (scrollContainer.clientWidth / 2 - measureRect.width / 2);
    const maxScrollLeft = Math.max(0, scrollContainer.scrollWidth - scrollContainer.clientWidth);
    const nextScrollLeft = Math.min(Math.max(0, targetScrollLeft), maxScrollLeft);

    scrollContainer.scrollTo({ left: nextScrollLeft, behavior: 'smooth' });
};

const StickyWrapper = ({ children, className = "" }) => (
    <div className={`absolute inset-0 flex items-center pointer-events-none ${className}`}>
        <div className="mx-auto px-6 pointer-events-auto">
            {children}
        </div>
    </div>
);

const StickyIconWrapper = ({ children, className = "" }) => (
    <div className={`absolute inset-0 flex items-center pointer-events-none ${className}`}>
        <div className="sticky px-8 left-2 right-2 mx-auto w-fit pointer-events-auto">
            {children}
        </div>
    </div>
);

export function MeasureControls({
    measureCount,
    stepsPerMeasure,
    grouping,
    pendingDelete,
    setPendingDelete,
    removeMeasure,
    zoom,
    gridOriginOffset,
}) {
    const config = ZOOM_CONFIG[zoom];

    if (measureCount <= 1) return null;

    return (
        // Pinned to the floor of the grid viewport: a landscape phone cannot show
        // the whole grid, and as the last row of the column this bar was the first
        // thing to fall off the bottom — taking measure deletion with it. Sticky
        // keeps it scrolling horizontally with the measures, which it must to stay
        // aligned to them. It needs its own background because only the measure
        // buttons carry one, so rows would otherwise show through the gaps once it
        // floats over them. bottom-0 rather than matching the column's mb-4: any
        // offset leaves a band below the bar for rows to scroll through in plain
        // sight. Sticky never pushes past the natural position, so over the last
        // 16px of travel the bar just rides the content up off the floor.
        <div
            className={`sticky bottom-0 flex items-stretch z-30 bg-surface-1 border-t border-border-dim`}
            style={{ marginTop: `${config.groupGap}px` }}
        >

            {/* Sticky Spacer matching instrument label */}
            <div className="sticky left-0 flex-shrink-0 z-0" style={{ width: `${gridOriginOffset ?? 48}px` }} />

            <div className={`flex-1 flex`} >
                {[...Array(measureCount)].map((_, measureIdx) => {
                    const isPending = pendingDelete === measureIdx;
                    const width = measureWidth(stepsPerMeasure, grouping, zoom);

                    return (
                        <div
                            key={measureIdx}
                            className={`group flex-none flex cursor-pointer transition-left border border-surface-5 relative
                                ${isPending
                                    ? 'bg-red-500/10 z-50 overflow-visible'
                                    : 'bg-surface-6 hover:bg-surface-4 text-danger-dim hover:text-red-500'
                                }
                            `}
                            style={{
                                height: ROW_LAYOUT.measureBarPx,
                                width: `${width}px`,
                                marginRight: `${config.groupGap}px`
                            }}
                            onClick={(event) => {
                                if (isPending) return;
                                if (pendingDelete === null) {
                                    centerMeasureInView(event.currentTarget);
                                    setPendingDelete(measureIdx);
                                }
                            }}
                            data-measure-control-index={measureIdx}
                        >
                            {isPending ? (
                                <StickyWrapper className="z-50">
                                    <div className="flex shadow-xl">
                                        <ConfirmBar
                                            measureIndex={measureIdx}
                                            onConfirm={() => { removeMeasure && removeMeasure(measureIdx); setPendingDelete(null); }}
                                            onCancel={() => setPendingDelete(null)}
                                        />
                                    </div>
                                </StickyWrapper>
                            ) : (
                                <StickyIconWrapper>
                                    <span className="align-baseline text-md font-bold transition-transform group-hover:-translate-y-0.5">x</span>
                                </StickyIconWrapper>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
