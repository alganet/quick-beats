// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { f16ToF32, loadWeights, __resetWeightsCache } from './grooveWeights';
// The precise encoder that produced the committed weights.bin.
import { f32ToF16 as f32ToF16Precise } from '../../scripts/prep-groovae-weights.mjs';

// float32 -> uint16 half, for crafting test fixtures.
const f32ToF16 = (val) => {
    const f32 = new Float32Array([val]);
    const x = new Int32Array(f32.buffer)[0];
    const sign = (x >> 16) & 0x8000;
    let mant = x & 0x007fffff;
    let exp = ((x >> 23) & 0xff) - 127 + 15;
    if (exp >= 0x1f) return sign | 0x7c00;
    if (exp <= 0) return sign;
    return sign | (exp << 10) | (mant >> 13);
};

describe('grooveWeights', () => {
    describe('f16ToF32', () => {
        it('decodes exact round-trips for representative values', () => {
            for (const v of [0, 1, -1, 0.5, -0.25, 2, 0.1, -0.7]) {
                expect(f16ToF32(f32ToF16(v))).toBeCloseTo(v, 2);
            }
        });

        it('decodes zero and one exactly', () => {
            expect(f16ToF32(0x0000)).toBe(0);
            expect(f16ToF32(0x3c00)).toBe(1); // 1.0 in half
        });

        it('decodes the special exponents (Inf / NaN / subnormal)', () => {
            expect(f16ToF32(0x7c00)).toBe(Infinity);   // +Inf
            expect(f16ToF32(0xfc00)).toBe(-Infinity);  // -Inf
            expect(Number.isNaN(f16ToF32(0x7e00))).toBe(true); // NaN (exp all-ones, frac set)
            expect(f16ToF32(0x0001)).toBeCloseTo(Math.pow(2, -24), 30); // smallest subnormal
            expect(f16ToF32(0x8001)).toBeCloseTo(-Math.pow(2, -24), 30);
        });
    });

    // Guards the encode/decode pair that generates the committed weights: the
    // precise script encoder must round-trip through the runtime decoder within
    // fp16 precision, including subnormals and overflow-to-Inf.
    describe('f32ToF16 (prep script) <-> f16ToF32 round-trip', () => {
        it('round-trips normal-range values within fp16 epsilon', () => {
            for (const v of [0, 1, -1, 0.5, -0.25, 0.1, -0.7, 3.14159, -123.5, 65000]) {
                const back = f16ToF32(f32ToF16Precise(v));
                // fp16 has ~3-4 significant digits; tolerance scales with magnitude.
                const tol = Math.max(1e-3, Math.abs(v) * 2 ** -10);
                expect(Math.abs(back - v)).toBeLessThanOrEqual(tol);
            }
        });

        it('encodes a subnormal magnitude without flushing it to zero', () => {
            const v = Math.pow(2, -20); // representable fp16 subnormal
            expect(f16ToF32(f32ToF16Precise(v))).toBeCloseTo(v, 30);
        });

        it('overflows magnitudes beyond fp16 range to Infinity', () => {
            expect(f16ToF32(f32ToF16Precise(1e30))).toBe(Infinity);
            expect(f16ToF32(f32ToF16Precise(-1e30))).toBe(-Infinity);
        });
    });

    describe('loadWeights', () => {
        beforeEach(() => __resetWeightsCache());
        afterEach(() => {
            __resetWeightsCache();
            vi.unstubAllGlobals();
        });

        it('fetches meta + bin and dequantizes into a Map', async () => {
            const meta = { dtype: 'fp16', weights: { 'a/kernel': { offset: 0, shape: [2, 2] } } };
            const vals = [0.5, -0.5, 1, -1];
            const u16 = Uint16Array.from(vals.map(f32ToF16));

            const fetchMock = vi.fn((url) => {
                if (url.endsWith('meta.json')) {
                    return Promise.resolve({ ok: true, json: () => Promise.resolve(meta) });
                }
                return Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(u16.buffer) });
            });
            vi.stubGlobal('fetch', fetchMock);

            const weights = await loadWeights('/base/');
            const w = weights.get('a/kernel');
            expect(w.shape).toEqual([2, 2]);
            expect(Array.from(w.data).map((v) => Number(v.toFixed(2)))).toEqual([0.5, -0.5, 1, -1]);
        });

        it('memoizes: second call does not re-fetch', async () => {
            const meta = { weights: {} };
            const fetchMock = vi.fn((url) =>
                url.endsWith('meta.json')
                    ? Promise.resolve({ ok: true, json: () => Promise.resolve(meta) })
                    : Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)) }),
            );
            vi.stubGlobal('fetch', fetchMock);
            await loadWeights('/base/');
            const callsAfterFirst = fetchMock.mock.calls.length;
            await loadWeights('/base/');
            expect(fetchMock.mock.calls.length).toBe(callsAfterFirst);
        });

        it('streams weights.bin with progress when the body is readable', async () => {
            const meta = { weights: { 'a/kernel': { offset: 0, shape: [2, 2] } } };
            const vals = [0.5, -0.5, 1, -1];
            const u16 = Uint16Array.from(vals.map(f32ToF16));
            const bytes = new Uint8Array(u16.buffer);
            const mid = Math.floor(bytes.length / 2);
            const chunks = [bytes.slice(0, mid), bytes.slice(mid)];
            let i = 0;
            const reader = {
                read: () => i < chunks.length
                    ? Promise.resolve({ done: false, value: chunks[i++] })
                    : Promise.resolve({ done: true, value: undefined }),
            };
            const fetchMock = vi.fn((url) =>
                url.endsWith('meta.json')
                    ? Promise.resolve({ ok: true, json: () => Promise.resolve(meta) })
                    : Promise.resolve({
                        ok: true,
                        headers: { get: () => String(bytes.length) },
                        body: { getReader: () => reader },
                    }),
            );
            vi.stubGlobal('fetch', fetchMock);

            const onProgress = vi.fn();
            const weights = await loadWeights('/base/', onProgress);
            expect(Array.from(weights.get('a/kernel').data).map((v) => Number(v.toFixed(2)))).toEqual([0.5, -0.5, 1, -1]);
            expect(onProgress).toHaveBeenCalled();
            expect(onProgress).toHaveBeenLastCalledWith(1);
        });

        it('throws on HTTP error', async () => {
            vi.stubGlobal(
                'fetch',
                vi.fn(() => Promise.resolve({ ok: false, status: 404 })),
            );
            await expect(loadWeights('/base/')).rejects.toThrow();
        });
    });
});
