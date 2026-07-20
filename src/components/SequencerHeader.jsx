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
    onSeek,
    onSeekStep
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

    // The keyboard equivalent of click-to-seek, which had none. stopPropagation
    // keeps the arrows from also reaching the grid container's roving-focus
    // delegation once focus is on the ruler.
    const handleKeyDown = (e) => {
        if (!onSeekStep) return;
        let next;
        switch (e.key) {
            case 'ArrowLeft':
            case 'ArrowDown': next = currentStep - 1; break;
            case 'ArrowRight':
            case 'ArrowUp': next = currentStep + 1; break;
            case 'PageUp': next = currentStep - stepsPerMeasure; break;
            case 'PageDown': next = currentStep + stepsPerMeasure; break;
            case 'Home': next = 0; break;
            case 'End': next = stepCount - 1; break;
            default: return;
        }
        e.preventDefault();
        e.stopPropagation();
        onSeekStep(Math.max(0, Math.min(stepCount - 1, next)));
    };

    return (
        <div
            role="slider"
            tabIndex={0}
            aria-label="Playhead position"
            aria-valuemin={1}
            aria-valuemax={stepCount}
            aria-valuenow={currentStep + 1}
            aria-valuetext={`Step ${currentStep + 1} of ${stepCount}`}
            aria-orientation="horizontal"
            className={`flex h-6 md:h-8 ${GRID_LAYOUT.headerOffsetClass} border-border-dim bg-surface-1 ${config.gapClass} cursor-pointer`}
            onClick={handleClick}
            onKeyDown={handleKeyDown}
        >
            {[...Array(stepCount)].map((_, i) => {
                const headerMeasureIdx = Math.floor(i / stepsPerMeasure);
                return (
                    <div
                        key={i}
                        className={`flex-none ${config.cellClass} flex items-center justify-center text-[10px] font-mono border-b-transparent hover:border-b-accent border-l-[2px] border-l-transparent border-b-[2px] border-r-[2px] border-r-transparent transition-colors
                    ${(i + 1) % grouping === 0 ? config.groupGapClass : ''}
                ${i === currentStep ? 'text-accent font-bold' : 'text-fg-dim'}
                ${i % stepsPerMeasure === 0 ? 'border-0 border-t-2 border-t-border-bright' : ''}
                ${pendingDelete === headerMeasureIdx ? 'opacity-30' : ''}
                `}
                    >
                        {i % grouping === 0 ? (i / grouping) + 1 : ''}
                    </div>);
            })}
        </div>
    );
}
