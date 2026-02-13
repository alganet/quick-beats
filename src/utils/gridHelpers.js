// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { BACKBEATS } from '../data/patterns';

export const generateGridFromSig = (sig, instruments) => {
    const patternData = BACKBEATS[sig.name];
    const stepsPerMeasure = sig.beats * sig.stepsPerBeat;

    return instruments.map((inst) => {
        const row = Array(stepsPerMeasure).fill(false);
        const instrumentPattern = patternData?.rhythm?.[inst] || [];
        instrumentPattern.forEach(step => {
            if (step < stepsPerMeasure) row[step] = true;
        });
        return row;
    });
};

export const toggleGridStep = (grid, row, col) => {
    return grid.map((r, rIdx) => {
        if (rIdx === row) {
            return r.map((c, cIdx) => (cIdx === col ? !c : c));
        }
        return r;
    });
};

export const calculateBulkUpdate = (grid, row, col, mode, timeSignature) => {
    if (!timeSignature) return grid;

    const stepsPerMeasure = timeSignature.beats * timeSignature.stepsPerBeat;
    const pulseLength = timeSignature.grouping;
    const posInPulse = col % pulseLength;
    const startPulseIdx = Math.floor(col / pulseLength);

    return grid.map((r, rIdx) => {
        if (rIdx === row) {
            return r.map((c, cIdx) => {
                const currentStepInMeasure = cIdx % stepsPerMeasure;
                const currentStepPosInPulse = currentStepInMeasure % pulseLength;

                if (currentStepPosInPulse === posInPulse) {
                    const pulseIdxAcrossAll = Math.floor(cIdx / pulseLength);
                    if (mode === 'repeat') return true;
                    if (mode === 'clear') return false;
                    if (mode === 'alternate') return pulseIdxAcrossAll % 2 === startPulseIdx % 2;
                }
                return c;
            });
        }
        return r;
    });
};

export const calculateNewMeasure = (grid, timeSignature) => {
    const stepsPerMeasure = timeSignature.beats * timeSignature.stepsPerBeat;
    const grouping = timeSignature.grouping;
    const currentTotalSteps = grid[0].length;

    // Musically relevant periods: subdivision, pulse/grouping, 2-beat backbeat, measure, and multi-measure
    const periods = [
        1, // Subdivision (e.g. constant 16th notes)
        grouping,
        grouping * 2, // 2-beat backbeat (essential for alternating Kick/Snare in odd meters)
        stepsPerMeasure,
        stepsPerMeasure * 2
    ];

    return grid.map(row => {
        const newMeasureSteps = Array(stepsPerMeasure).fill(null);
        const isClaimed = Array(stepsPerMeasure).fill(false);

        // Hierarchical Additive Fill: Pulse -> Measure -> Phrase
        for (const period of periods) {
            // Validation: Require 2+ instances unless we are cloning the only existing measure (seed)
            const isSeedClone = (period === currentTotalSteps);
            if (!isSeedClone && period * 2 > currentTotalSteps) continue;

            const pattern = Array(period).fill(false);
            const confidence = Array(period).fill(0);

            for (let i = 0; i < period; i++) {
                let occurrences = 0;
                let total = 0;
                for (let base = i; base < currentTotalSteps; base += period) {
                    total++;
                    if (row[base]) occurrences++;
                }
                const freq = occurrences / total;
                // Threshold 0.7 as manually adjusted by user for better detection
                pattern[i] = freq >= 0.70;
                // Confidence is high if it's very consistent
                confidence[i] = Math.abs(freq - 0.5) * 2;
            }

            // Apply this period's pattern to unclaimed steps
            for (let j = 0; j < stepsPerMeasure; j++) {
                if (isClaimed[j]) continue;

                const stepIdx = currentTotalSteps + j;
                const posInPeriod = stepIdx % period;

                // If this period is very confident (>0.8) about its pattern, claim it
                if (confidence[posInPeriod] > 0.8) {
                    newMeasureSteps[j] = pattern[posInPeriod];
                    isClaimed[j] = true;
                }
            }
        }

        // Any remaining unclaimed steps default to false (silent)
        const finalizedSteps = newMeasureSteps.map(step => step === null ? false : step);
        return [...row, ...finalizedSteps];
    });
};

export const calculateGridWithRemovedMeasure = (grid, measureIndex, timeSignature) => {
    const stepsPerMeasure = timeSignature.beats * timeSignature.stepsPerBeat;
    const startIndex = measureIndex * stepsPerMeasure;

    // Don't allow deleting the last measure
    if (grid[0].length <= stepsPerMeasure) return grid;

    return grid.map(row => {
        const newRow = [...row];
        newRow.splice(startIndex, stepsPerMeasure);
        return newRow;
    });
};
