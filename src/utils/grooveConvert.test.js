// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Deterministic stub model: every class is "hit" with velocity 0.5, offset 0.
const humanizeSpy = vi.fn();
vi.mock('./grooveModel', async (orig) => {
    const actual = await orig();
    return { ...actual, humanize: (...a) => humanizeSpy(...a) };
});

import {
    ROW_TO_CLASS,
    gridWindowToInput,
    createPerfLayer,
    windowStarts,
    decoderOutputToPerf,
    rescaleOffsets,
    computePerfLayer,
    windowHasHits,
} from './grooveConvert';
import { NUM_STEPS, NUM_CLASSES, DEPTH } from './grooveModel';

const stubOutput = () =>
    Array.from({ length: NUM_STEPS }, () => {
        const row = new Float32Array(DEPTH);
        for (let c = 0; c < NUM_CLASSES; c++) {
            row[c] = 1; // hit
            row[NUM_CLASSES + c] = 0.5; // velocity
        }
        return row;
    });

const emptyGrid = (rows, steps) =>
    Array.from({ length: rows }, () => new Array(steps).fill(false));

describe('grooveConvert', () => {
    describe('gridWindowToInput', () => {
        it('encodes hits only (velocity + offset stay zero)', () => {
            const grid = emptyGrid(7, 32);
            grid[0][0] = true; // Kick -> class 0
            grid[1][4] = true; // Snare -> class 1
            const input = gridWindowToInput(grid, 0);
            expect(input).toHaveLength(NUM_STEPS);
            expect(input[0]).toHaveLength(DEPTH);
            expect(input[0][0]).toBe(1); // kick hit
            expect(input[4][1]).toBe(1); // snare hit
            // velocity + offset sections are all zero
            for (let s = 0; s < NUM_STEPS; s++) {
                for (let k = NUM_CLASSES; k < DEPTH; k++) {
                    expect(input[s][k]).toBe(0);
                }
            }
        });

        it('maps Tom/Crash/Ride rows to classes 5/7/8', () => {
            const grid = emptyGrid(7, 32);
            grid[4][1] = true; // Tom -> 5
            grid[5][2] = true; // Crash -> 7
            grid[6][3] = true; // Ride -> 8
            const input = gridWindowToInput(grid, 0);
            expect(input[1][5]).toBe(1);
            expect(input[2][7]).toBe(1);
            expect(input[3][8]).toBe(1);
            expect(ROW_TO_CLASS).toEqual([0, 1, 2, 3, 5, 7, 8]);
        });

        it('wraps (loops) past the grid end instead of padding silence', () => {
            const grid = emptyGrid(7, 16); // 1 bar
            grid[0][0] = true; // kick on the downbeat
            const input = gridWindowToInput(grid, 0);
            expect(input).toHaveLength(NUM_STEPS);
            expect(input[0][0]).toBe(1);
            expect(input[16][0]).toBe(1); // step 16 wraps to step 0 -> kick repeats
            expect(input[20].every((v) => v === 0)).toBe(true); // step 20 -> step 4, empty
        });

        it('does not wrap within an exact 2-bar (32-step) grid', () => {
            const grid = emptyGrid(7, 32);
            grid[0][0] = true;
            const input = gridWindowToInput(grid, 0);
            expect(input[0][0]).toBe(1);
            // no other kick anywhere in the window (no spurious wrap)
            expect(input.filter((v) => v[0] === 1)).toHaveLength(1);
        });

        it('reads from the window offset', () => {
            const grid = emptyGrid(7, 64);
            grid[0][32] = true;
            const input = gridWindowToInput(grid, 32);
            expect(input[0][0]).toBe(1);
        });
    });

    describe('windowStarts', () => {
        it('chunks into NUM_STEPS windows', () => {
            expect(windowStarts(32)).toEqual([0]);
            expect(windowStarts(64)).toEqual([0, 32]);
            expect(windowStarts(48)).toEqual([0, 32]);
            expect(windowStarts(16)).toEqual([0]);
        });
    });

    describe('decoderOutputToPerf', () => {
        const makeOutput = (fill) =>
            Array.from({ length: NUM_STEPS }, () => {
                const row = new Float32Array(DEPTH);
                fill(row);
                return row;
            });

        it('writes vel + offsetSec for active cells with a model hit', () => {
            const grid = emptyGrid(7, 32);
            grid[0][0] = true; // kick, class 0
            const out = makeOutput((row) => {
                row[0] = 1; // hit class 0
                row[NUM_CLASSES + 0] = 0.5; // velocity
                row[2 * NUM_CLASSES + 0] = 1; // offset tanh max -> step shift
            });
            const perf = createPerfLayer(7, 32);
            decoderOutputToPerf(perf, out, 0, 120, grid);
            const cell = perf[0][0];
            expect(cell).not.toBeNull();
            expect(cell.vel).toBeCloseTo(0.5, 5);
            // offRaw=1 -> offset = -(1/2)*stepLen; stepLen = 60/120/4 = 0.125
            // -(0.5)*0.125 = -0.0625, clamped to +/-0.5*0.125=0.0625 -> -0.0625
            expect(cell.offsetSec).toBeCloseTo(-0.0625, 5);
        });

        it('clamps offset to +/- half a step', () => {
            const grid = emptyGrid(7, 32);
            grid[0][0] = true;
            const out = makeOutput((row) => {
                row[0] = 1;
                row[NUM_CLASSES] = 0.8;
                row[2 * NUM_CLASSES] = -1; // extreme negative
            });
            const perf = createPerfLayer(7, 32);
            decoderOutputToPerf(perf, out, 0, 120, grid);
            const stepLen = 60 / 120 / 4;
            expect(Math.abs(perf[0][0].offsetSec)).toBeLessThanOrEqual(0.5 * stepLen + 1e-9);
        });

        it('leaves active cells null when the model drops the hit', () => {
            const grid = emptyGrid(7, 32);
            grid[0][0] = true;
            const out = makeOutput((row) => {
                row[0] = 0; // no hit
            });
            const perf = createPerfLayer(7, 32);
            decoderOutputToPerf(perf, out, 0, 120, grid);
            expect(perf[0][0]).toBeNull();
        });

        it('ignores model hits on inactive grid cells', () => {
            const grid = emptyGrid(7, 32); // nothing active
            const out = makeOutput((row) => {
                row[1] = 1; // model fires snare class
                row[NUM_CLASSES + 1] = 0.9;
            });
            const perf = createPerfLayer(7, 32);
            decoderOutputToPerf(perf, out, 0, 120, grid);
            expect(perf[1][0]).toBeNull();
        });

        it('stops at the grid end for a partial final window (non-multiple-of-32)', () => {
            // 48-step grid: the window at startStep 32 only has 16 valid steps.
            const grid = emptyGrid(7, 48);
            grid[0][32] = true;
            grid[0][47] = true; // last in-range step of this window
            const out = makeOutput((row) => { row[0] = 1; row[NUM_CLASSES] = 0.8; });
            const perf = createPerfLayer(7, 48);
            decoderOutputToPerf(perf, out, 32, 120, grid);
            expect(perf[0]).toHaveLength(48); // no write past the grid end (steps 48..63)
            expect(perf[0][32]).not.toBeNull();
            expect(perf[0][47]).not.toBeNull();
        });

    });

    describe('windowHasHits', () => {
        it('detects any active cell within a 32-step window', () => {
            const grid = emptyGrid(7, 64);
            grid[0][40] = true;
            expect(windowHasHits(grid, 0)).toBe(false);
            expect(windowHasHits(grid, 32)).toBe(true); // step 40 is in [32,64)
        });
    });

    describe('computePerfLayer', () => {
        beforeEach(() => {
            humanizeSpy.mockReset();
            humanizeSpy.mockImplementation(stubOutput);
        });

        it('returns null for an empty grid', () => {
            expect(computePerfLayer({}, [], 120)).toBeNull();
        });

        it('runs the model once per non-empty window and fills active cells', () => {
            const grid = emptyGrid(7, 32);
            grid[0][0] = true;
            const perf = computePerfLayer({}, grid, 120);
            expect(humanizeSpy).toHaveBeenCalledTimes(1);
            expect(perf[0][0].vel).toBe(0.5);
            expect(perf[0][0].offsetSec).toBeCloseTo(0, 10);
            expect(perf[1][0]).toBeNull();
        });

        it('windows a multi-bar grid and skips empty windows', () => {
            const grid = emptyGrid(7, 64);
            grid[0][0] = true; // window 0 only
            const perf = computePerfLayer({}, grid, 120);
            expect(humanizeSpy).toHaveBeenCalledTimes(1);
            expect(perf[0]).toHaveLength(64);
        });

        it('calls onWindow once per computed window with the cumulative layer', () => {
            const grid = emptyGrid(7, 64);
            grid[0][0] = true; // window 0
            grid[0][32] = true; // window 1
            const seen = [];
            const perf = computePerfLayer({}, grid, 120, (partial) => {
                // snapshot what's filled so far (cumulative, grows each window)
                seen.push([partial[0][0] !== null, partial[0][32] !== null]);
            });
            expect(humanizeSpy).toHaveBeenCalledTimes(2);
            expect(seen).toEqual([[true, false], [true, true]]); // window 0, then 0+1
            // final return equals the last cumulative state
            expect(perf[0][0]).not.toBeNull();
            expect(perf[0][32]).not.toBeNull();
        });
    });

    describe('rescaleOffsets', () => {
        it('scales offsetSec by oldBpm/newBpm, keeps velocity', () => {
            const perf = createPerfLayer(2, 2);
            perf[0][0] = { vel: 0.7, offsetSec: 0.02 };
            const out = rescaleOffsets(perf, 120, 60);
            expect(out[0][0].vel).toBe(0.7);
            expect(out[0][0].offsetSec).toBeCloseTo(0.04, 6); // 120/60 = 2x
            expect(out[1][1]).toBeNull();
        });
    });
});
