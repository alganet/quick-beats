// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC


import { useEffect, useRef } from 'react';
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

    // Resolving the confirmation (Yes or No) unmounts the ConfirmBar, whose
    // focused button drops keyboard focus to <body>. Hand it back to the delete
    // strip at that slot (after a delete, the next measure inherits the index;
    // clamp for the last one). Gated on <body> so a pointer user who resolved
    // by clicking isn't yanked, mirroring the dialogs' opener restore.
    const prevPendingRef = useRef(pendingDelete);
    useEffect(() => {
        const prev = prevPendingRef.current;
        prevPendingRef.current = pendingDelete;
        if (prev === null || pendingDelete !== null) return;
        if (document.activeElement !== document.body) return;
        const idx = Math.min(prev, measureCount - 1);
        document.querySelector(`button[data-measure-control-index="${idx}"]`)?.focus();
    }, [pendingDelete, measureCount]);

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
                    const sizeStyle = {
                        height: ROW_LAYOUT.measureBarPx,
                        width: `${width}px`,
                        marginRight: `${config.groupGap}px`
                    };

                    // Two elements, not one: while idle this is a real <button>
                    // (keyboard focusable, named), but once pending it hosts the
                    // ConfirmBar's own Yes/No buttons — and a button may not
                    // contain buttons.
                    return isPending ? (
                        <div
                            key={measureIdx}
                            className="group flex-none flex transition-left border border-surface-5 relative bg-danger/10 z-50 overflow-visible"
                            style={sizeStyle}
                            data-measure-control-index={measureIdx}
                        >
                            <StickyWrapper className="z-50">
                                <div className="flex shadow-xl">
                                    <ConfirmBar
                                        measureIndex={measureIdx}
                                        onConfirm={() => { removeMeasure && removeMeasure(measureIdx); setPendingDelete(null); }}
                                        onCancel={() => setPendingDelete(null)}
                                    />
                                </div>
                            </StickyWrapper>
                        </div>
                    ) : (
                        <button
                            key={measureIdx}
                            type="button"
                            aria-label={`Delete measure ${measureIdx + 1}`}
                            className="group flex-none flex cursor-pointer transition-left border border-surface-5 relative bg-surface-6 hover:bg-surface-4 text-danger-dim hover:text-danger"
                            style={sizeStyle}
                            onClick={(event) => {
                                if (pendingDelete === null) {
                                    centerMeasureInView(event.currentTarget);
                                    setPendingDelete(measureIdx);
                                }
                            }}
                            data-measure-control-index={measureIdx}
                        >
                            <StickyIconWrapper>
                                <span aria-hidden="true" className="align-baseline text-md font-bold transition-transform group-hover:-translate-y-0.5">x</span>
                            </StickyIconWrapper>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
