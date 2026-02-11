// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import React, { useRef } from "react";
import { INSTRUMENTS } from "../data/kit";
import { Icon } from "./Icons";

const INSTRUMENT_ICONS = {
    "Kick": "kick",
    "Snare": "snare",
    "Hi-Hat Closed": "hihat-closed",
    "Hi-Hat Open": "hihat-open",
    "Tom": "tom",
    "Crash": "crash",
    "Ride": "ride"
};

const ZOOM_CONFIG = {
    0: { // Small
        cellWidth: 20, // w-5
        gap: 2,        // gap-0.5
        groupGap: 8,   // mr-2
        cellHeight: 28, // h-7
        cellClass: 'w-5',
        heightClass: 'h-7',
        gapClass: 'gap-0.5',
        groupGapClass: 'mr-2'
    },
    1: { // Medium
        cellWidth: 32, // w-8
        gap: 4,        // gap-1
        groupGap: 12,  // mr-3
        cellHeight: 40, // h-10
        cellClass: 'w-8',
        heightClass: 'h-10',
        gapClass: 'gap-1',
        groupGapClass: 'mr-3'
    },
    2: { // Large
        cellWidth: 40, // w-10
        gap: 4,        // gap-1
        groupGap: 16,  // mr-4
        cellHeight: 48, // h-12
        cellClass: 'w-10',
        heightClass: 'h-12',
        gapClass: 'gap-1',
        groupGapClass: 'mr-4'
    }
};

export default function Sequencer({ isPlaying, grid, toggleStep, currentStep, stepCount = 16, setStep, addMeasure, beatsPerMeasure = 4, stepsPerBeat = 4, grouping = 4, autoScroll, setAutoScroll, setCanScroll, zoom }) {
    const scrollContainerRef = useRef(null);
    const [playheadOffRight, setPlayheadOffRight] = React.useState(false);
    const [playheadOffLeft, setPlayheadOffLeft] = React.useState(false);

    const stepsPerMeasure = beatsPerMeasure * stepsPerBeat;

    const calculateStepFromEvent = (e) => {
        if (!scrollContainerRef.current) return 0;

        const config = ZOOM_CONFIG[zoom] || ZOOM_CONFIG[1];
        const container = scrollContainerRef.current;
        const rect = container.getBoundingClientRect();
        const scrollLeft = container.scrollLeft;

        // Label width logic
        const labelCol = container.querySelector('.sticky');
        const labelWidth = labelCol ? labelCol.offsetWidth : (window.innerWidth < 768 ? 48 : 64);

        const padding = window.innerWidth < 768 ? 2 : 4;

        // Click position within the scrollable content
        const x = e.clientX - rect.left + scrollLeft - labelWidth - padding;

        // Calculate step width including group gaps
        const stepWidth = config.cellWidth + config.gap;
        const totalSteps = stepCount;

        // Approximate step calculation accounting for grouping gaps
        // We can solve for 'i': x = i * (cellWidth + gap) + floor(i/grouping) * groupGap
        // Simplification: i = x / (stepWidth + groupGap/grouping)
        const i = Math.floor(x / (stepWidth + (config.groupGap / grouping)));

        return Math.max(0, Math.min(totalSteps - 1, i));
    };

    const handleSeek = (e) => {
        const newStep = calculateStepFromEvent(e);
        if (setStep) setStep(newStep);
    };


    // Auto-scroll logic
    React.useEffect(() => {
        if (scrollContainerRef.current) {
            const config = ZOOM_CONFIG[zoom] || ZOOM_CONFIG[1];
            const padding = window.innerWidth < 768 ? 2 : 4;
            const currentPos = padding + currentStep * (config.cellWidth + config.gap) + Math.floor(currentStep / grouping) * config.groupGap;

            const containerWidth = scrollContainerRef.current.clientWidth;
            const scrollLeft = scrollContainerRef.current.scrollLeft;

            // Adjust label width for dynamic view
            const labelCol = scrollContainerRef.current.querySelector('.sticky');
            const labelWidth = labelCol ? labelCol.offsetWidth : 64;

            // Offset the check by the label width since we want to see the handle relative to the whole container
            const handlePos = currentPos + labelWidth;

            // Update off-screen state
            const isOffRight = handlePos > scrollLeft + containerWidth;
            const isOffLeft = handlePos < scrollLeft + labelWidth;

            if (isOffRight !== playheadOffRight) {
                setPlayheadOffRight(isOffRight);
            }
            if (isOffLeft !== playheadOffLeft) {
                setPlayheadOffLeft(isOffLeft);
            }

            if (!autoScroll) return;


            if (handlePos > scrollLeft + containerWidth - 100) {
                scrollContainerRef.current.scrollTo({ left: handlePos - (containerWidth / 2), behavior: 'smooth' });
            }
            if (handlePos < scrollLeft + labelWidth + 20) {
                scrollContainerRef.current.scrollTo({ left: 0, behavior: 'smooth' });
            }
        }
    }, [currentStep, stepCount, grouping, autoScroll, playheadOffRight, playheadOffLeft, zoom]);

    // Detect if scrolling is possible
    React.useEffect(() => {
        if (!scrollContainerRef.current) return;

        const checkScroll = () => {
            const container = scrollContainerRef.current;
            if (container) {
                const hasScroll = container.scrollWidth > container.clientWidth;
                setCanScroll(hasScroll);
            }
        };

        const observer = new ResizeObserver(checkScroll);
        observer.observe(scrollContainerRef.current);

        // Also check on mount
        checkScroll();

        return () => observer.disconnect();
    }, [setCanScroll, stepCount]);

    const handleManualScroll = () => {
        if (autoScroll) setAutoScroll(false);
    };

    return (
        <div className="flex-1 flex flex-col overflow-hidden relative select-none bg-[#0a0a0a] border-t border-[#1e1e1e]">
            {/* Playhead off-screen indicators - Fixed at top corners */}
            {playheadOffRight && !autoScroll && (
                <div className="absolute right-0 top-0 h-8 flex items-center pr-0 z-50 pointer-events-none">
                    <div className={`text-white transition-opacity ${isPlaying ? 'animate-pulse-subtle' : 'opacity-60'}`}>
                        <Icon id="arrow-right" className="w-10 h-10" />
                    </div>
                </div>
            )}
            {playheadOffLeft && !autoScroll && (
                <div className="absolute left-12 md:left-16 top-0 h-8 flex items-center pl-0 z-50 pointer-events-none">
                    <div className={`text-white transition-opacity ${isPlaying ? 'animate-pulse-subtle' : 'opacity-60'}`}>
                        <Icon id="arrow-left" className="w-10 h-10" />
                    </div>
                </div>
            )}
            <div
                ref={scrollContainerRef}
                className="relative flex-1 overflow-x-auto overflow-y-hidden"
                onWheel={handleManualScroll}
                onTouchMove={handleManualScroll}
            >
                <div style={{ width: 'max-content', minWidth: '100%', height: '100%' }}>
                    {/* Header (Beat Numbers) - Now clickable for seeking */}
                    <div
                        className={`flex h-8 ml-12 md:ml-16 border-b border-[#1e1e1e] bg-[#0a0a0a]/80 ${ZOOM_CONFIG[zoom].gapClass} cursor-pointer hover:bg-white/[0.03] transition-colors`}
                        onClick={(e) => handleSeek(e)}
                    >

                        {[...Array(stepCount)].map((_, i) => (
                            <div
                                key={i}
                                className={`flex-none ${ZOOM_CONFIG[zoom].cellClass} flex items-center justify-center text-[10px] font-mono
                            ${(i + 1) % grouping === 0 ? ZOOM_CONFIG[zoom].groupGapClass : ''}
                            ${i === currentStep ? 'text-[#22d3ee] font-bold' : 'text-slate-600'}
                            `}
                            >
                                {i % grouping === 0 ? (i / grouping) + 1 : ''}
                            </div>
                        ))}
                        <div className="flex-none w-12 ml-2" />
                    </div>

                    <div className="relative flex">
                        {/* Grid */}
                        <div className="flex flex-col">
                            {INSTRUMENTS.map((instrument, rowIdx) => (
                                <div key={instrument} className={`flex items-center ${ZOOM_CONFIG[zoom].heightClass} group hover:bg-white/[0.02]`}>
                                    {/* Sticky Instrument Label - Narrowed for Icons */}
                                    <div className="sticky left-0 w-12 md:w-16 flex-shrink-0 flex items-center justify-center z-20 bg-[#141414] group-hover:bg-[#1e1e1e] transition-colors h-full border-r border-[#1e1e1e] shadow-[2px_0_5px_rgba(0,0,0,0.5)]" title={instrument}>
                                        <Icon id={INSTRUMENT_ICONS[instrument] || 'kick'} className="w-5 h-5 text-slate-400 group-hover:text-white transition-colors" />
                                    </div>
                                    <div className={`flex-1 flex h-full relative p-0.5 md:p-1 ${ZOOM_CONFIG[zoom].gapClass}`}>
                                        {grid[rowIdx] && grid[rowIdx].map((isActive, colIdx) => {
                                            const isPlaying = isActive && colIdx === currentStep;
                                            const config = ZOOM_CONFIG[zoom];
                                            return (
                                                <div
                                                    key={colIdx}
                                                    onMouseDown={() => toggleStep(rowIdx, colIdx)}
                                                    className={`flex-none ${config.cellClass} cursor-pointer transition-all duration-75 relative rounded-md
                            ${(colIdx + 1) % grouping === 0 ? config.groupGapClass : ''}
                            ${isPlaying
                                                            ? "bg-[#22d3ee] shadow-[0_0_12px_rgba(34,211,238,0.5)]"
                                                            : isActive
                                                                ? "bg-[#3b82f6]"
                                                                : "bg-[#222] hover:bg-[#444]"}
                            ${colIdx % stepsPerMeasure === 0 ? 'ring-1 ring-inset ring-white/5' : ''}
                            `}
                                                >
                                                    {/* Beat indicator dot for measure starts */}
                                                    {colIdx % stepsPerMeasure === 0 && !isActive && (
                                                        <div className="absolute top-1 right-1 w-1 h-1 rounded-full bg-[#333]" />
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <button
                            onClick={() => addMeasure()}
                            className="flex-none w-12 self-stretch flex items-center justify-center cursor-pointer bg-[#141414] hover:bg-[#1e1e1e] text-slate-600 hover:text-[#3b82f6] transition-all border-l border-[#1e1e1e] ml-2 group/add-btn"
                            title="Add Measure"
                        >
                            <span className="text-2xl font-light group-hover/add-btn:scale-110 transition-transform">+</span>
                        </button>

                        {/* Playhead Overlay - Perfectly Aligned via Grid Mapping */}
                        <div className="absolute inset-0 pointer-events-none flex flex-col ml-12 md:ml-16">
                            <div className={`flex h-full p-0.5 md:p-1 ${ZOOM_CONFIG[zoom].gapClass}`}>
                                {[...Array(stepCount)].map((_, i) => (
                                    <div
                                        key={i}
                                        className={`flex-none ${ZOOM_CONFIG[zoom].cellClass} relative h-full ${(i + 1) % grouping === 0 ? ZOOM_CONFIG[zoom].groupGapClass : ''}`}
                                    >
                                        {i === currentStep && (
                                            <div className="absolute top-0 bottom-0 left-0 -ml-[1px] w-[2.5px] bg-[#22d3ee] z-10" />
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
