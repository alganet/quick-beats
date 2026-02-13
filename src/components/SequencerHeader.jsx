// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC


import { ZOOM_CONFIG } from '../data/sequencerConfig';
import { GRID_LAYOUT } from '../utils/sequencerGeometry';

export function SequencerHeader({ 
    stepCount, 
    stepsPerMeasure, 
    grouping, 
    currentStep, 
    pendingDelete, 
    zoom,
    onSeek 
}) {
    const config = ZOOM_CONFIG[zoom] || ZOOM_CONFIG[1];

    // Helper to calculate step from click event
    const handleClick = (e) => {
        // Label width logic and calculation needs to match the hook, but for now we pass the event up
        // Or we can encapsulate the math here? 
        // The original code passed the event to `handleSeek` which did the math.
        // We can pass `calculateStepFromEvent` or just `onSeek(e)`.
        onSeek(e);
    };

    return (
        <div
            className={`flex h-6 md:h-8 ${GRID_LAYOUT.headerOffsetClass} border-[#1e1e1e] bg-[#111] ${config.gapClass} cursor-pointer`}
            onClick={handleClick}
        >
            {[...Array(stepCount)].map((_, i) => {
                const headerMeasureIdx = Math.floor(i / stepsPerMeasure);
                return (
                    <div
                        key={i}
                        className={`flex-none ${config.cellClass} flex items-center justify-center text-[10px] font-mono border-b-transparent hover:border-b-[#22d3ee] border-l-[2px] border-l-transparent border-b-[2px] border-r-[2px] border-r-transparent transition-colors
                    ${(i + 1) % grouping === 0 ? config.groupGapClass : ''}
                ${i === currentStep ? 'text-[#22d3ee] font-bold' : 'text-slate-600'}
                ${i % stepsPerMeasure === 0 ? 'border-0 border-t-2 border-t-[#555]' : ''}
                ${pendingDelete === headerMeasureIdx ? 'opacity-30' : ''}
                `}
                    >
                        {i % grouping === 0 ? (i / grouping) + 1 : ''}
                    </div>);
            })}
        </div>
    );
}
