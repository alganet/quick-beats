// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

// WASM SIMD backend for the GrooVAE matmul (assembly/groove.ts -> groove.wasm).
// JS owns a single linear memory: weights are copied in once, scratch buffers
// hold the per-call input/output vectors. Exposes the same `affine(segments,
// kName, bName)` shape as grooveModel's jsBackend, so it drops straight in.
//
// createWasmBackend returns null on any failure (no WebAssembly, no SIMD, OOM),
// and the caller falls back to the pure-JS backend — identical output, slower.

const ALIGN = 16; // keep f32x4 loads/stores aligned
const alignUp = (n) => (n + (ALIGN - 1)) & ~(ALIGN - 1);

const PAGE = 65536;

/**
 * Build a WASM-backed affine backend from a dequantized weights Map.
 * @param {Map<string,{data:Float32Array,shape:number[]}>} weights
 * @param {ArrayBuffer|Uint8Array} wasmBytes  compiled groove.wasm bytes
 * @returns {{affine:Function}|null}
 */
export const createWasmBackend = (weights, wasmBytes) => {
    try {
        if (typeof WebAssembly === 'undefined' || !wasmBytes) return null;

        // Lay out weights contiguously (16B-aligned), then two scratch regions.
        const layout = new Map(); // name -> { byteOffset, outDim }
        let cursor = 0;
        let maxIn = 0;
        let maxOut = 0;
        for (const [name, { data, shape }] of weights) {
            const outDim = shape.length > 1 ? shape[1] : shape[0];
            layout.set(name, { byteOffset: cursor, outDim });
            cursor = alignUp(cursor + data.length * 4);
            if (shape.length > 1) {
                maxIn = Math.max(maxIn, shape[0]);
                maxOut = Math.max(maxOut, shape[1]);
            }
        }
        const scratchInByte = cursor;
        cursor = alignUp(cursor + maxIn * 4);
        const scratchOutByte = cursor;
        cursor = alignUp(cursor + maxOut * 4);

        const pages = Math.ceil(cursor / PAGE) + 1;
        const memory = new WebAssembly.Memory({ initial: pages });
        // Throws on validation if SIMD is unsupported -> caught -> JS fallback.
        const module = new WebAssembly.Module(wasmBytes instanceof Uint8Array ? wasmBytes : new Uint8Array(wasmBytes));
        const instance = new WebAssembly.Instance(module, { env: { memory } });
        const wasmAffine = instance.exports.affine;

        const f32 = new Float32Array(memory.buffer); // stable: memory never grows
        for (const [name, { data }] of weights) {
            f32.set(data, layout.get(name).byteOffset / 4);
        }

        const scratchInF = scratchInByte / 4;
        const scratchOutF = scratchOutByte / 4;

        const affine = (segments, kName, bName) => {
            const k = layout.get(kName);
            const outDim = k.outDim;
            // Pack the segments contiguously into the input scratch.
            let off = scratchInF;
            for (const seg of segments) {
                f32.set(seg, off);
                off += seg.length;
            }
            const inLen = off - scratchInF;
            wasmAffine(scratchInByte, inLen, k.byteOffset, layout.get(bName).byteOffset, scratchOutByte, outDim);
            // Copy out before the next call reuses the scratch.
            return f32.slice(scratchOutF, scratchOutF + outDim);
        };

        return { kind: 'wasm', affine };
    } catch {
        return null; // any failure -> caller uses the JS backend
    }
};
