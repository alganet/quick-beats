// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

// SIMD matmul kernel for the GrooVAE forward pass. The model's control flow and
// gate nonlinearities stay in JS (src/utils/grooveModel.js); only the hot affine
// `bias + concat(inputs) . kernel` lives here, where ~all the time is spent.
//
// Memory is imported and owned by JS (see src/utils/grooveWasm.js), which lays
// out the weights + scratch and passes absolute byte offsets. Everything is f32.

// out[o] = bias[o] + sum_k in[k] * K[k*outDim + o]
//   inPtr/bPtr/outPtr/kPtr : byte offsets into shared memory (f32, 16B-aligned)
//   inLen  : number of input elements (concatenated segments)
//   outDim : number of output elements (== kernel columns)
// Vectorized over o with f32x4; zero inputs are skipped (the grids are sparse).
export function affine(
    inPtr: usize,
    inLen: i32,
    kPtr: usize,
    bPtr: usize,
    outPtr: usize,
    outDim: i32,
): void {
    // Seed the accumulator with the bias.
    let o = 0;
    for (; o + 4 <= outDim; o += 4) {
        const off = (<usize>o) << 2;
        v128.store(outPtr + off, v128.load(bPtr + off));
    }
    for (; o < outDim; o++) {
        const off = (<usize>o) << 2;
        store<f32>(outPtr + off, load<f32>(bPtr + off));
    }

    const rowBytes = (<usize>outDim) << 2;
    for (let k = 0; k < inLen; k++) {
        const v = load<f32>(inPtr + ((<usize>k) << 2));
        if (v == 0) continue; // sparsity: most encoder inputs (hits) are 0
        const vv = f32x4.splat(v);
        const base = kPtr + (<usize>k) * rowBytes;
        let c = 0;
        for (; c + 4 <= outDim; c += 4) {
            const off = (<usize>c) << 2;
            const kv = v128.load(base + off);
            const ov = v128.load(outPtr + off);
            v128.store(outPtr + off, f32x4.add(ov, f32x4.mul(vv, kv)));
        }
        for (; c < outDim; c++) {
            const off = (<usize>c) << 2;
            store<f32>(outPtr + off, load<f32>(outPtr + off) + v * load<f32>(base + off));
        }
    }
}
