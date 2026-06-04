// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { describe, it, expect, beforeAll } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { encode, humanize, jsBackend, __internals, NUM_STEPS, NUM_CLASSES, DEPTH } from './grooveModel';
import { f16ToF32 } from './grooveWeights';
import { gridWindowToInput, ROW_TO_CLASS } from './grooveConvert';

const { dense, lstmStep, sigmoid } = __internals;

describe('grooveModel internals', () => {
    it('dense computes x . kernel + bias', () => {
        const x = new Float32Array([1, 2]);
        const kernel = { data: new Float32Array([1, 0, 1, 0, 1, 1]), shape: [2, 3] };
        const bias = { data: new Float32Array([0, 0, 1]), shape: [3] };
        expect(Array.from(dense(x, kernel, bias))).toEqual([1, 2, 4]);
    });

    it('lstmStep applies gates with forgetBias=1', () => {
        // H=1, inDim=1; zero kernel so gates == bias. Large bias -> saturated gates.
        const kernel = { data: new Float32Array(2 * 4), shape: [2, 4] };
        const bias = { data: new Float32Array([10, 10, 10, 10]), shape: [4] }; // i,j,f,o
        const { c, h } = lstmStep(new Float32Array([0]), new Float32Array([0]), new Float32Array([0]), kernel, bias);
        // newC = sigmoid(f+1)*0 + sigmoid(i)*tanh(j) ~= 1*1 = 1
        expect(c[0]).toBeCloseTo(1, 2);
        // newH = tanh(newC)*sigmoid(o) ~= tanh(1)*1
        expect(h[0]).toBeCloseTo(Math.tanh(1), 2);
    });

    it('sigmoid is monotonic around 0', () => {
        expect(sigmoid(0)).toBeCloseTo(0.5, 6);
        expect(sigmoid(10)).toBeGreaterThan(0.99);
        expect(sigmoid(-10)).toBeLessThan(0.01);
    });

    it('jsBackend is tagged kind "js" and computes affine = bias + x . kernel', () => {
        const weights = new Map([
            ['k', { data: new Float32Array([1, 0, 1, 0, 1, 1]), shape: [2, 3] }],
            ['b', { data: new Float32Array([0, 0, 1]), shape: [3] }],
        ]);
        const backend = jsBackend(weights);
        expect(backend.kind).toBe('js');
        expect(Array.from(backend.affine([new Float32Array([1, 2])], 'k', 'b'))).toEqual([1, 2, 4]);
    });
});

// Integration against the real (committed) GrooVAE weights. These assert the
// model's *characteristic* humanization behavior — the agreed correctness check.
const WEIGHTS_PATH = join(process.cwd(), 'public/models/groovae/weights.bin');
const META_PATH = join(process.cwd(), 'public/models/groovae/meta.json');
const hasWeights = existsSync(WEIGHTS_PATH) && existsSync(META_PATH);

const loadWeightsFromFs = () => {
    const meta = JSON.parse(readFileSync(META_PATH, 'utf8'));
    const buf = readFileSync(WEIGHTS_PATH);
    const u16 = new Uint16Array(buf.buffer, buf.byteOffset, buf.byteLength / 2);
    const weights = new Map();
    for (const [name, { offset, shape }] of Object.entries(meta.weights)) {
        const n = shape.reduce((a, b) => a * b, 1);
        const data = new Float32Array(n);
        for (let i = 0; i < n; i++) data[i] = f16ToF32(u16[offset + i]);
        weights.set(name, { data, shape });
    }
    return weights;
};

describe.skipIf(!hasWeights)('grooveModel + real GrooVAE weights', () => {
    let weights;
    let out;
    const grid = Array.from({ length: 7 }, () => new Array(32).fill(false));
    for (let s = 0; s < 32; s += 8) grid[0][s] = true; // kick on quarters
    for (let s = 4; s < 32; s += 8) grid[1][s] = true; // snare backbeats
    for (let s = 0; s < 32; s += 2) grid[2][s] = true; // closed hat 8ths

    beforeAll(() => {
        weights = loadWeightsFromFs();
        out = humanize(weights, gridWindowToInput(grid, 0));
    });

    it('encode produces a finite z of length 256', () => {
        const z = encode(weights, gridWindowToInput(grid, 0));
        expect(z).toHaveLength(256);
        expect(z.every((v) => Number.isFinite(v))).toBe(true);
    });

    it('decode output shape and ranges are valid', () => {
        expect(out).toHaveLength(NUM_STEPS);
        for (const row of out) {
            expect(row).toHaveLength(DEPTH);
            for (let k = 0; k < NUM_CLASSES; k++) {
                expect([0, 1]).toContain(row[k]); // hits binary
                expect(row[NUM_CLASSES + k]).toBeGreaterThanOrEqual(0); // vel 0..1
                expect(row[NUM_CLASSES + k]).toBeLessThanOrEqual(1);
                expect(Math.abs(row[2 * NUM_CLASSES + k])).toBeLessThanOrEqual(1); // offset -1..1
            }
        }
    });

    it('retains all placed hits', () => {
        for (let r = 0; r < 3; r++) {
            const c = ROW_TO_CLASS[r];
            for (let s = 0; s < 32; s++) {
                if (grid[r][s]) expect(out[s][c]).toBe(1);
            }
        }
    });

    it('produces expressive velocity dynamics (not constant)', () => {
        const kickVels = [0, 8, 16, 24].map((s) => out[s][NUM_CLASSES + 0]);
        const spread = Math.max(...kickVels) - Math.min(...kickVels);
        expect(spread).toBeGreaterThan(0.1);
    });

    it('accents downbeats over offbeats (kick) and alternates hi-hats', () => {
        // kick: step 0 (downbeat) louder than step 8 (offbeat)
        expect(out[0][NUM_CLASSES + 0]).toBeGreaterThan(out[8][NUM_CLASSES + 0]);
        // hi-hat (class 2): even 8ths accented vs odd ghosted (GrooVAE signature)
        expect(out[0][NUM_CLASSES + 2]).toBeGreaterThan(out[2][NUM_CLASSES + 2]);
        expect(out[4][NUM_CLASSES + 2]).toBeGreaterThan(out[6][NUM_CLASSES + 2]);
    });

    it('is deterministic (same input -> same output)', () => {
        const again = humanize(weights, gridWindowToInput(grid, 0));
        expect(again[0][NUM_CLASSES + 0]).toBeCloseTo(out[0][NUM_CLASSES + 0], 6);
    });

    it('an explicit jsBackend produces the same output as a raw weights Map', () => {
        const viaBackend = humanize(jsBackend(weights), gridWindowToInput(grid, 0));
        expect(viaBackend[0][NUM_CLASSES + 0]).toBeCloseTo(out[0][NUM_CLASSES + 0], 10);
    });

    it('matches the golden kick velocity within tolerance', () => {
        // Captured from the verified port (fp16 weights, deterministic decode).
        expect(out[0][NUM_CLASSES + 0]).toBeCloseTo(0.67, 1);
    });
});
