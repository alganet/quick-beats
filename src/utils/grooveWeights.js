// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

// Loads the fp16-packed GrooVAE weights produced by scripts/prep-groovae-weights.mjs.
// Pure data: a meta.json index + a weights.bin of little-endian uint16 (fp16).
// No tensorflow / magenta / onnx — the model math lives in grooveModel.js.

const MODEL_PATH = 'models/groovae/';

// IEEE-754 half (uint16) -> float32 number.
export const f16ToF32 = (h) => {
    const sign = (h & 0x8000) >> 15;
    const exp = (h & 0x7c00) >> 10;
    const frac = h & 0x03ff;
    const s = sign ? -1 : 1;
    if (exp === 0) {
        return s * Math.pow(2, -14) * (frac / 1024);
    }
    if (exp === 0x1f) {
        return frac ? NaN : s * Infinity;
    }
    return s * Math.pow(2, exp - 15) * (1 + frac / 1024);
};

const dequantize = (u16, offset, count) => {
    const out = new Float32Array(count);
    for (let i = 0; i < count; i++) {
        out[i] = f16ToF32(u16[offset + i]);
    }
    return out;
};

const prod = (shape) => shape.reduce((a, b) => a * b, 1);

let cache = null;

/**
 * Fetch + dequantize the GrooVAE weights once. Returns a Map keyed by the
 * tfjs variable name -> { data: Float32Array, shape: number[] }.
 *
 * @param {string} [baseUrl] Base URL for the asset (defaults to Vite's BASE_URL).
 */
export const loadWeights = async (baseUrl) => {
    if (cache) return cache;
    const base = baseUrl ?? (import.meta.env?.BASE_URL ?? '/');
    const root = base.endsWith('/') ? base : base + '/';

    const [meta, binBuf] = await Promise.all([
        fetch(root + MODEL_PATH + 'meta.json').then((r) => {
            if (!r.ok) throw new Error(`groove meta ${r.status}`);
            return r.json();
        }),
        fetch(root + MODEL_PATH + 'weights.bin').then((r) => {
            if (!r.ok) throw new Error(`groove weights ${r.status}`);
            return r.arrayBuffer();
        }),
    ]);

    const u16 = new Uint16Array(binBuf);
    const weights = new Map();
    for (const [name, { offset, shape }] of Object.entries(meta.weights)) {
        weights.set(name, { data: dequantize(u16, offset, prod(shape)), shape });
    }
    cache = weights;
    return cache;
};

// Test seam: discard the memoized weights.
export const __resetWeightsCache = () => {
    cache = null;
};
