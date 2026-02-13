// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { useCallback, useEffect, useRef, useState } from "react";
import { INSTRUMENTS } from "../data/kit";
import { ZOOM_CONFIG } from "../data/sequencerConfig";
import { Icon } from "./Icons";
import ContextMenu from "./ContextMenu";
import { useSequencerSelection } from "../hooks/useSequencerSelection";
import { useAutoScroll } from "../hooks/useAutoScroll";
import { SequencerHeader } from "./SequencerHeader";
import { MemoizedInstrumentRow } from "./InstrumentRow";
import { MeasureControls } from "./MeasureControls";
import { PlayheadOverlay } from "./PlayheadOverlay";
import { getGridOriginOffsetPx, isMobileViewport, xToStep } from "../utils/sequencerGeometry";




export default function Sequencer({ isPlaying, togglePlay, grid, toggleStep, bulkUpdateStep, currentStep, stepCount = 16, setStep, addMeasure, removeMeasure, beatsPerMeasure = 4, stepsPerBeat = 4, grouping = 4, autoScroll, setAutoScroll, setCanScroll, zoom }) {
    const scrollContainerRef = useRef(null);
    const [pendingDelete, setPendingDelete] = useState(null);
    const [gridOriginOffset, setGridOriginOffset] = useState(getGridOriginOffsetPx(isMobileViewport()));
    const geometryRef = useRef({
        left: 0,
        scrollLeft: 0,
        gridOriginOffset: getGridOriginOffsetPx(isMobileViewport()),
        containerWidth: 0,
    });
    const [visibleRange, setVisibleRange] = useState({ start: 0, end: stepCount });

    const { menuState, setMenuState, menuRef } = useSequencerSelection({ onBulkUpdate: bulkUpdateStep });
    
    // Auto-scroll hook
    const { playheadOffRight, playheadOffLeft, handleManualScroll } = useAutoScroll({
        scrollContainerRef,
        currentStep,
        stepCount,
        grouping,
        autoScroll,
        setAutoScroll,
        setCanScroll,
        zoom,
        gridOriginOffset
    });

    const stepsPerMeasure = beatsPerMeasure * stepsPerBeat;
    const measureCount = Math.floor(stepCount / stepsPerMeasure);

    const updateGeometryAndRange = useCallback(() => {
        const container = scrollContainerRef.current;
        if (!container) return;

        const rect = container.getBoundingClientRect();
        const firstRow = container.querySelector('[data-grid-row="true"]');
        const labelCol = firstRow?.querySelector('[data-grid-label="true"]');
        const lane = firstRow?.querySelector('[data-grid-lane="true"]');
        const fallbackOffset = getGridOriginOffsetPx(isMobileViewport());
        const labelWidth = labelCol?.getBoundingClientRect().width ?? 0;
        const laneStyles = lane ? window.getComputedStyle(lane) : null;
        const laneMarginLeft = laneStyles ? parseFloat(laneStyles.marginLeft || '0') : 0;
        const lanePaddingLeft = laneStyles ? parseFloat(laneStyles.paddingLeft || '0') : 0;
        const measuredOffset = labelCol && lane
            ? Math.round(labelWidth + laneMarginLeft + lanePaddingLeft)
            : fallbackOffset;
        const containerWidth = container.clientWidth;
        const scrollLeft = container.scrollLeft;

        setGridOriginOffset((previous) => (previous === measuredOffset ? previous : measuredOffset));

        geometryRef.current = {
            left: rect.left,
            scrollLeft,
            gridOriginOffset: measuredOffset,
            containerWidth,
        };

        const leftEdge = Math.max(0, scrollLeft - measuredOffset);
        const rightEdge = Math.max(0, scrollLeft + containerWidth - measuredOffset);
        const overscan = 12;
        const start = Math.max(0, xToStep(leftEdge, stepCount, grouping, zoom) - overscan);
        const end = Math.min(stepCount, xToStep(rightEdge, stepCount, grouping, zoom) + overscan + 1);

        setVisibleRange((previous) => (
            previous.start === start && previous.end === end
                ? previous
                : { start, end }
        ));
    }, [grouping, stepCount, zoom]);

    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) return;

        let animationFrameId = null;
        const updateOnScroll = () => {
            if (animationFrameId !== null) return;
            animationFrameId = window.requestAnimationFrame(() => {
                animationFrameId = null;
                updateGeometryAndRange();
            });
        };

        const resizeObserver = new ResizeObserver(() => {
            updateGeometryAndRange();
        });

        resizeObserver.observe(container);
        const labelCol = container.querySelector('.sticky');
        if (labelCol) resizeObserver.observe(labelCol);

        container.addEventListener('scroll', updateOnScroll, { passive: true });
        window.addEventListener('resize', updateGeometryAndRange);
        updateOnScroll();

        return () => {
            if (animationFrameId !== null) {
                window.cancelAnimationFrame(animationFrameId);
            }
            resizeObserver.disconnect();
            container.removeEventListener('scroll', updateOnScroll);
            window.removeEventListener('resize', updateGeometryAndRange);
        };
    }, [updateGeometryAndRange]);

    const calculateStepFromEvent = (e) => {
        const { left, scrollLeft, gridOriginOffset } = geometryRef.current;

        // Click position within the scrollable content
        const x = e.clientX - left + scrollLeft - gridOriginOffset;
        return xToStep(x, stepCount, grouping, zoom);
    };

    const handleSeek = (e) => {
        const newStep = calculateStepFromEvent(e);
        if (setStep) setStep(newStep);
        // If currently playing, stop playback when the user seeks via header
        if (isPlaying && typeof togglePlay === 'function') togglePlay();
    };

    return (
        <div className="flex-1 flex flex-col overflow-hidden relative select-none bg-[#111]">
            {menuState.isOpen && (
                <ContextMenu
                    ref={menuRef}
                    x={menuState.x}
                    y={menuState.y}
                    activeOption={menuState.activeOption}
                    grouping={grouping}
                    colInGroup={menuState.col % grouping}
                />
            )}
            {/* Playhead off-screen indicators - Fixed at top corners */}
            {playheadOffRight && !autoScroll && (
                <div className="absolute right-0 top-0 h-6 md:h-8 flex items-center pr-0 z-50 pointer-events-none">
                    <div className={`text-[#22d3ee] transition-opacity ${isPlaying ? 'animate-pulse-subtle' : ''}`}>
                        <Icon id="arrow-right" className="w-10 h-10" />
                    </div>
                </div>
            )}
            {playheadOffLeft && !autoScroll && (
                <div className="absolute left-0 md:left-0 top-0 h-6 md:h-8 flex items-center pl-0 z-50 pointer-events-none">
                    <div className={`text-[#22d3ee] transition-opacity ${isPlaying ? 'animate-pulse-subtle' : ''}`}>
                        <Icon id="arrow-left" className="w-10 h-10" />
                    </div>
                </div>
            )}
            <div
                ref={scrollContainerRef}
                className="relative flex-1 overflow-x-auto overflow-y"
                data-sequencer-scroll-container="true"
                onWheel={handleManualScroll}
                onTouchMove={handleManualScroll}
            >
                <div style={{ width: 'max-content', minWidth: '100%', height: '100%', display: 'flex', flexDirection: 'row' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>

                        {/* Header (Beat Numbers) - Now clickable for seeking */}
                        <SequencerHeader
                            stepCount={stepCount}
                            stepsPerMeasure={stepsPerMeasure}
                            grouping={grouping}
                            currentStep={currentStep}
                            pendingDelete={pendingDelete}
                            zoom={zoom}
                            gridOriginOffset={gridOriginOffset}
                            onSeek={handleSeek}
                        />

                        <div className="relative flex">
                            {/* Grid */}
                            <div className="flex flex-col mb-4">
                                {INSTRUMENTS.map((instrument, rowIdx) => (
                                    <MemoizedInstrumentRow
                                        key={instrument}
                                        instrument={instrument}
                                        rowIdx={rowIdx}
                                        gridRow={grid[rowIdx]}
                                        stepCount={stepCount}
                                        stepsPerMeasure={stepsPerMeasure}
                                        grouping={grouping}
                                        toggleStep={toggleStep}
                                        bulkUpdateStep={bulkUpdateStep}
                                        setMenuState={setMenuState}
                                        pendingDelete={pendingDelete}
                                        zoom={zoom}
                                        visibleRange={visibleRange}
                                    />
                                ))}

                                {/* Delete Measure Footer */}
                                <MeasureControls
                                    measureCount={measureCount}
                                    stepsPerMeasure={stepsPerMeasure}
                                    grouping={grouping}
                                    pendingDelete={pendingDelete}
                                    setPendingDelete={setPendingDelete}
                                    removeMeasure={removeMeasure}
                                    zoom={zoom}
                                    gridOriginOffset={gridOriginOffset}
                                />
                            </div>

                            <button
                                onClick={() => addMeasure()}
                                style={{ width: ZOOM_CONFIG[zoom].cellHeight }}
                                className="flex-none w-12 self-stretch flex items-center justify-center cursor-pointer bg-[#000] hover:bg-[#1e1e1e] text-slate-600 hover:text-[#3b82f6] transition-all border border-[#222] border-r-0 mt-1 mb-4 group/add-btn"
                                title="Add Measure"
                            >
                                <span className="text-xl font-light transition-transform">+</span>
                            </button>

                            {/* Playhead Overlay - Perfectly Aligned via Grid Mapping (subtract cellHeight to account for border) */}
                            <PlayheadOverlay
                                stepCount={stepCount}
                                currentStep={currentStep}
                                grouping={grouping}
                                zoom={zoom}
                                measureCount={measureCount}
                                gridOriginOffset={gridOriginOffset}
                            />
                        </div>

                    </div>
                </div>
            </div>
        </div >
    );
}
