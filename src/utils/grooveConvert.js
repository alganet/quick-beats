// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

// Bridges quick-beats' binary grid <-> GrooVAE tensors, and turns the model's
// per-step output into the "performance layer" the audio engine reads.
// Pure functions; no model / DOM dependencies.

import { NUM_STEPS, NUM_CLASSES, DEPTH, humanize } from './grooveModel';

const MAX_WINDOWS = 16; // 512 steps; guard against pathological grids

// GrooveConverter's 9 drum classes (order): kick, snare, closedHH, openHH,
// lowTom, midTom, hiTom, crash, ride. quick-beats' 7 instrument rows
// (kit.js INSTRUMENTS order) map onto these classes:
//   0 Kick, 1 Snare, 2 Hi-Hat Closed, 3 Hi-Hat Open, 4 Tom, 5 Crash, 6 Ride
export const ROW_TO_CLASS = [0, 1, 2, 3, 5, 7, 8];

const stepLengthSec = (bpm) => 60 / bpm / 4; // 16th-note duration

/**
 * Build the model input for one 32-step window starting at `startStep`.
 * GrooVAE humanize input is HITS ONLY (velocity + offset are zero — the model
 * infers them). Steps beyond the grid are left empty (padding).
 * @returns {Float32Array[]} NUM_STEPS rows of length DEPTH.
 */
export const gridWindowToInput = (grid, startStep) => {
    const input = [];
    const rows = Math.min(grid.length, ROW_TO_CLASS.length);
    const totalSteps = grid[0]?.length || 0;
    for (let i = 0; i < NUM_STEPS; i++) {
        const vec = new Float32Array(DEPTH);
        // Wrap past the grid end so GrooVAE always sees a coherent looping groove
        // (a 1-bar beat fills the 2-bar input by repeating, not by silence).
        const step = totalSteps ? (startStep + i) % totalSteps : startStep + i;
        for (let r = 0; r < rows; r++) {
            if (grid[r] && grid[r][step]) {
                vec[ROW_TO_CLASS[r]] = 1; // hit; vel/offset stay 0
            }
        }
        input.push(vec);
    }
    return input;
};

/** Allocate an all-null performance layer matching the grid shape. */
export const createPerfLayer = (numRows, totalSteps) =>
    Array.from({ length: numRows }, () => new Array(totalSteps).fill(null));

/** Window start indices covering `totalSteps` in NUM_STEPS chunks. */
export const windowStarts = (totalSteps) => {
    const starts = [];
    for (let s = 0; s < totalSteps; s += NUM_STEPS) starts.push(s);
    return starts;
};

/**
 * Write one decoded window's velocity + microtiming into `perfLayer`, for the
 * grid cells the user actually placed. Model hits on inactive cells are ignored;
 * active cells the model dropped are left null (played flat by the audio loop).
 */
export const decoderOutputToPerf = (perfLayer, output, startStep, bpm, grid) => {
    const totalSteps = perfLayer[0]?.length ?? 0;
    const stepLen = stepLengthSec(bpm);
    const maxOff = 0.5 * stepLen;
    const rows = Math.min(grid.length, ROW_TO_CLASS.length);
    for (let i = 0; i < NUM_STEPS; i++) {
        const step = startStep + i;
        if (step >= totalSteps) break;
        const row = output[i];
        for (let r = 0; r < rows; r++) {
            if (!(grid[r] && grid[r][step])) continue; // only user-placed hits
            const c = ROW_TO_CLASS[r];
            if (row[c] <= 0.5) {
                perfLayer[r][step] = null; // model dropped it -> flat
                continue;
            }
            const vel = row[NUM_CLASSES + c]; // [0,1]
            const offRaw = row[2 * NUM_CLASSES + c]; // tanh [-1,1]
            // GrooveConverter: startTime = (s - offRaw/2) * stepLen, so the
            // offset added to the quantized time is -(offRaw/2) steps.
            let offsetSec = -(offRaw / 2) * stepLen;
            if (offsetSec > maxOff) offsetSec = maxOff;
            else if (offsetSec < -maxOff) offsetSec = -maxOff;
            perfLayer[r][step] = { vel, offsetSec };
        }
    }
};

/** True if any cell in the [start, start+32) window is active. */
export const windowHasHits = (grid, start) => {
    for (let r = 0; r < grid.length; r++) {
        const row = grid[r];
        if (!row) continue;
        for (let s = start; s < start + NUM_STEPS && s < row.length; s++) {
            if (row[s]) return true;
        }
    }
    return false;
};

/**
 * Full grid -> performance layer. Synchronous and self-contained so it can run
 * inside a Web Worker (see src/workers/grooveWorker.js). Windows the grid into
 * 32-step chunks, runs the model per non-empty window, and stitches the result.
 * Returns null when there is nothing to humanize.
 */
export const computePerfLayer = (weights, grid, bpm) => {
    if (!grid || grid.length === 0 || !grid[0] || grid[0].length === 0) return null;
    const totalSteps = grid[0].length;
    const perf = createPerfLayer(grid.length, totalSteps);
    let starts = windowStarts(totalSteps);
    if (starts.length > MAX_WINDOWS) starts = starts.slice(0, MAX_WINDOWS);
    for (const start of starts) {
        if (!windowHasHits(grid, start)) continue;
        const out = humanize(weights, gridWindowToInput(grid, start));
        decoderOutputToPerf(perf, out, start, bpm, grid);
    }
    return perf;
};

/**
 * Rescale microtiming when BPM changes (offset-in-steps is BPM-invariant, so
 * seconds scale by oldBpm/newBpm). Returns a new layer; velocity unchanged.
 */
export const rescaleOffsets = (perfLayer, oldBpm, newBpm) => {
    const factor = oldBpm / newBpm;
    return perfLayer.map((row) =>
        row.map((cell) =>
            cell ? { vel: cell.vel, offsetSec: cell.offsetSec * factor } : null,
        ),
    );
};
