// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { describe, it, expect, beforeAll } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createWasmBackend } from './grooveWasm';
import { humanize, jsBackend, NUM_STEPS, NUM_CLASSES, DEPTH } from './grooveModel';
import { f16ToF32 } from './grooveWeights';
import { gridWindowToInput } from './grooveConvert';

const WASM_PATH = join(process.cwd(), 'src/wasm/groove.wasm');
const WEIGHTS_PATH = join(process.cwd(), 'public/models/groovae/weights.bin');
const META_PATH = join(process.cwd(), 'public/models/groovae/meta.json');
const ready = existsSync(WASM_PATH) && existsSync(WEIGHTS_PATH) && existsSync(META_PATH);

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

describe('createWasmBackend', () => {
    it('returns null on invalid wasm bytes (caller falls back to JS)', () => {
        const weights = new Map([['k', { data: new Float32Array(4), shape: [2, 2] }]]);
        expect(createWasmBackend(weights, new Uint8Array([0, 1, 2, 3]))).toBeNull();
    });

    it('returns null when given no bytes', () => {
        expect(createWasmBackend(new Map(), null)).toBeNull();
    });
});

describe.skipIf(!ready)('grooveWasm SIMD backend vs JS (real weights)', () => {
    let weights;
    let wasmBytes;
    const grid = Array.from({ length: 7 }, () => new Array(32).fill(false));
    for (let s = 0; s < 32; s += 8) grid[0][s] = true; // kick
    for (let s = 4; s < 32; s += 8) grid[1][s] = true; // snare
    for (let s = 0; s < 32; s += 2) grid[2][s] = true; // hat

    beforeAll(() => {
        weights = loadWeightsFromFs();
        wasmBytes = readFileSync(WASM_PATH);
    });

    it('instantiates a backend exposing affine and tagged kind "wasm"', () => {
        const backend = createWasmBackend(weights, wasmBytes);
        expect(backend).not.toBeNull();
        expect(typeof backend.affine).toBe('function');
        expect(backend.kind).toBe('wasm');
    });

    it('matches the JS backend: identical hits, velocity/offset within fp tolerance', () => {
        const input = gridWindowToInput(grid, 0);
        const js = humanize(jsBackend(weights), input);
        const wa = humanize(createWasmBackend(weights, wasmBytes), input);

        for (let s = 0; s < NUM_STEPS; s++) {
            for (let k = 0; k < NUM_CLASSES; k++) {
                expect(wa[s][k]).toBe(js[s][k]); // hits are exact
            }
            for (let k = NUM_CLASSES; k < DEPTH; k++) {
                expect(wa[s][k]).toBeCloseTo(js[s][k], 4); // vel/offset ~ fp32 SIMD drift
            }
        }
    });
});
