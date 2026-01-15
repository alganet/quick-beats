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

export default function Sequencer({ grid, toggleStep, currentStep, stepCount = 16, setStep, addMeasure, beatsPerMeasure = 4, stepsPerBeat = 4, grouping = 4 }) {
    const scrollContainerRef = useRef(null);

    const stepsPerMeasure = beatsPerMeasure * stepsPerBeat;

    const calculateStepFromEvent = (e) => {
        if (!scrollContainerRef.current) return 0;

        const rect = scrollContainerRef.current.getBoundingClientRect();
        const scrollLeft = scrollContainerRef.current.scrollLeft;

        // Dynamically detect label column width
        const labelCol = scrollContainerRef.current.querySelector('.sticky');
        const labelWidth = labelCol ? labelCol.offsetWidth : 64;

        // X relative to the start of the grid content
        const x = e.clientX - rect.left + scrollLeft - labelWidth;

        // Account for grid padding (p-0.5 is 2px, p-1 is 4px)
        const padding = window.innerWidth < 768 ? 2 : 4;
        const relativeX = x - padding;

        if (relativeX < 0) return 0;

        // Find the step by calculating the start position of each step
        // Step width = 40 (w-10), gap = 4 (gap-1), grouping margin = 16 (mr-4)
        let bestStep = 0;
        let minDiff = Infinity;

        for (let i = 0; i < stepCount; i++) {
            const stepStart = i * 44 + Math.floor(i / grouping) * 16;
            const diff = Math.abs(relativeX - (stepStart + 20)); // Compare with center of step (40/2)
            if (diff < minDiff) {
                minDiff = diff;
                bestStep = i;
            }
        }

        return bestStep;
    };

    const handleSeek = (e) => {
        const newStep = calculateStepFromEvent(e);
        if (setStep) setStep(newStep);
    };


    // Auto-scroll logic
    React.useEffect(() => {
        if (scrollContainerRef.current) {
            const padding = window.innerWidth < 768 ? 2 : 4;
            const currentPos = padding + currentStep * 44 + Math.floor(currentStep / grouping) * 16;

            const containerWidth = scrollContainerRef.current.clientWidth;
            const scrollLeft = scrollContainerRef.current.scrollLeft;

            // Adjust label width for dynamic view
            const labelCol = scrollContainerRef.current.querySelector('.sticky');
            const labelWidth = labelCol ? labelCol.offsetWidth : 64;

            // Offset the check by the label width since we want to see the handle relative to the whole container
            const handlePos = currentPos + labelWidth;

            if (handlePos > scrollLeft + containerWidth - 100) {
                scrollContainerRef.current.scrollTo({ left: handlePos - (containerWidth / 2), behavior: 'smooth' });
            }
            if (handlePos < scrollLeft + labelWidth + 20) {
                scrollContainerRef.current.scrollTo({ left: 0, behavior: 'smooth' });
            }
        }
    }, [currentStep, stepCount, grouping]);

    return (
        <div className="flex-1 flex flex-col overflow-hidden relative select-none bg-[#0a0a0a] border-t border-[#1e1e1e]">
            <div
                ref={scrollContainerRef}
                className="relative flex-1 overflow-x-auto overflow-y-hidden"
            >
                <div style={{ width: 'max-content', minWidth: '100%', height: '100%' }}>
                    {/* Header (Beat Numbers) - Now clickable for seeking */}
                    <div
                        className="flex h-8 ml-12 md:ml-16 border-b border-[#1e1e1e] bg-[#0a0a0a]/80 gap-1 cursor-pointer hover:bg-white/[0.03] transition-colors"
                        onClick={(e) => handleSeek(e)}
                    >
                        {[...Array(stepCount)].map((_, i) => (
                            <div
                                key={i}
                                className={`flex-none w-10 flex items-center justify-start pl-2 text-[10px] font-mono 
                            ${(i + 1) % stepsPerMeasure === 0 ? 'text-[#3b82f6] font-bold' : 'text-slate-600'}
                            ${(i + 1) % grouping === 0 ? 'mr-4' : ''}`}
                            >
                                {i + 1}
                            </div>
                        ))}
                        <div className="flex-none w-12 ml-2" />
                    </div>

                    <div className="relative flex">
                        {/* Grid */}
                        <div className="flex flex-col">
                            {INSTRUMENTS.map((instrument, rowIdx) => (
                                <div key={instrument} className="flex items-center h-12 group hover:bg-white/[0.02]">
                                    {/* Sticky Instrument Label - Narrowed for Icons */}
                                    <div className="sticky left-0 w-12 md:w-16 flex-shrink-0 flex items-center justify-center z-20 bg-[#141414] group-hover:bg-[#1e1e1e] transition-colors h-full border-r border-[#1e1e1e] shadow-[2px_0_5px_rgba(0,0,0,0.5)]" title={instrument}>
                                        <Icon id={INSTRUMENT_ICONS[instrument] || 'kick'} className="w-5 h-5 text-slate-400 group-hover:text-white transition-colors" />
                                    </div>
                                    <div className="flex-1 flex h-full relative p-0.5 md:p-1 gap-1">
                                        {grid[rowIdx] && grid[rowIdx].map((isActive, colIdx) => (
                                            <div
                                                key={colIdx}
                                                onMouseDown={() => toggleStep(rowIdx, colIdx)}
                                                className={`flex-none w-10 cursor-pointer transition-all duration-75 relative
                            ${(colIdx + 1) % grouping === 0 ? 'mr-4' : ''}
                            ${isActive
                                                        ? "bg-[#3b82f6]"
                                                        : "bg-[#1e1e1e] hover:bg-[#262626]"}
                            ${colIdx % stepsPerMeasure === 0 ? 'ring-1 ring-inset ring-white/5' : ''}
                            `}
                                            >
                                                {/* Beat indicator dot for measure starts */}
                                                {colIdx % stepsPerMeasure === 0 && !isActive && (
                                                    <div className="absolute top-1 right-1 w-1 h-1 rounded-full bg-[#333]" />
                                                )}
                                            </div>
                                        ))}
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
                            <div className="flex h-full p-0.5 md:p-1 gap-1">
                                {[...Array(stepCount)].map((_, i) => (
                                    <div
                                        key={i}
                                        className={`flex-none w-10 relative h-full ${(i + 1) % grouping === 0 ? 'mr-4' : ''}`}
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
