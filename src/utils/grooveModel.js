// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

// Pure-JS port of the GrooVAE (groovae_2bar_humanize) forward pass, from the
// Magenta.js reference implementation (music_vae/model.ts, core/data.ts).
// No tensorflow / tfjs / onnx — just typed-array matrix math.
//
// Architecture: BidirectionalLstmEncoder (512) -> mu (z=256);
// 2-layer LSTM decoder (256,256) conditioned on z, autoregressive over 32 steps.
// Per-step I/O depth = 9 drum classes x 3 (hits, velocities, offsets) = 27.

export const NUM_STEPS = 32;
export const NUM_CLASSES = 9;
export const DEPTH = 27; // NUM_CLASSES * 3
const ENC_H = 512;
const DEC_H = 256;
const FORGET_BIAS = 1.0;

const W = {
    encFwK: 'encoder/cell_0/bidirectional_rnn/fw/multi_rnn_cell/cell_0/lstm_cell/kernel',
    encFwB: 'encoder/cell_0/bidirectional_rnn/fw/multi_rnn_cell/cell_0/lstm_cell/bias',
    encBwK: 'encoder/cell_0/bidirectional_rnn/bw/multi_rnn_cell/cell_0/lstm_cell/kernel',
    encBwB: 'encoder/cell_0/bidirectional_rnn/bw/multi_rnn_cell/cell_0/lstm_cell/bias',
    muK: 'encoder/mu/kernel',
    muB: 'encoder/mu/bias',
    z2iK: 'decoder/z_to_initial_state/kernel',
    z2iB: 'decoder/z_to_initial_state/bias',
    dec0K: 'decoder/multi_rnn_cell/cell_0/lstm_cell/kernel',
    dec0B: 'decoder/multi_rnn_cell/cell_0/lstm_cell/bias',
    dec1K: 'decoder/multi_rnn_cell/cell_1/lstm_cell/kernel',
    dec1B: 'decoder/multi_rnn_cell/cell_1/lstm_cell/bias',
    outK: 'decoder/output_projection/kernel',
    outB: 'decoder/output_projection/bias',
};

const sigmoid = (x) => 1 / (1 + Math.exp(-x));

// y = x . kernel + bias, where kernel is row-major [inDim, outDim].
const dense = (x, kernel, bias) => {
    const inDim = kernel.shape[0];
    const outDim = kernel.shape[1];
    const K = kernel.data;
    const out = new Float32Array(outDim);
    for (let o = 0; o < outDim; o++) {
        let sum = bias.data[o];
        for (let i = 0; i < inDim; i++) sum += x[i] * K[i * outDim + o];
        out[o] = sum;
    }
    return out;
};

// Apply LSTM gate nonlinearities to a precomputed gate vector `g` ([i,j,f,o]
// blocks of length H) given the previous cell `c`. forgetBias=1 (matches
// tf.basicLSTMCell). Cheap (O(H)); always runs in JS regardless of backend.
const applyGates = (g, c) => {
    const H = c.length;
    const newC = new Float32Array(H);
    const newH = new Float32Array(H);
    for (let k = 0; k < H; k++) {
        const i = g[k];
        const j = g[H + k];
        const f = g[2 * H + k];
        const o = g[3 * H + k];
        const nc = sigmoid(f + FORGET_BIAS) * c[k] + sigmoid(i) * Math.tanh(j);
        newC[k] = nc;
        newH[k] = Math.tanh(nc) * sigmoid(o);
    }
    return { c: newC, h: newH };
};

// One step of a basic LSTM cell (matches tf.basicLSTMCell with forgetBias=1).
// kernel is [inDim + H, 4*H], gate order [i, j, f, o]. Mutates nothing; returns
// fresh {c, h}. `x` has length inDim; `c`/`h` have length H. Standalone JS
// reference kept for unit tests (the model path goes through a backend).
const lstmStep = (x, c, h, kernel, bias) => {
    const H = c.length;
    const inDim = x.length;
    const K = kernel.data;
    const B = bias.data;
    const cols = 4 * H;
    const combinedLen = inDim + H;
    const g = new Float32Array(cols);
    for (let col = 0; col < cols; col++) g[col] = B[col];
    for (let k = 0; k < combinedLen; k++) {
        const v = k < inDim ? x[k] : h[k - inDim];
        if (v === 0) continue;
        const base = k * cols;
        for (let col = 0; col < cols; col++) g[col] += v * K[base + col];
    }
    return applyGates(g, c);
};

// The model's only hot primitive: affine = bias + concat(segments) . kernel.
// `affine(segments, kernelName, biasName) -> Float32Array(outDim)`. Both `dense`
// (one segment) and the LSTM gate matmul (segments = [...inputs, h]) reduce to
// this. The JS backend matches `dense`/`lstmStep` exactly (same accumulation
// order + zero-input sparsity skip); the WASM backend swaps in a SIMD kernel.
export const jsBackend = (weights) => ({
    kind: 'js',
    affine: (segments, kName, bName) => {
        const kernel = weights.get(kName);
        const bias = weights.get(bName);
        const outDim = kernel.shape[1];
        const K = kernel.data;
        const B = bias.data;
        const out = new Float32Array(outDim);
        for (let o = 0; o < outDim; o++) out[o] = B[o];
        let k = 0;
        for (const seg of segments) {
            for (let s = 0; s < seg.length; s++, k++) {
                const v = seg[s];
                if (v === 0) continue;
                const base = k * outDim;
                for (let o = 0; o < outDim; o++) out[o] += v * K[base + o];
            }
        }
        return out;
    },
});

const resolveBackend = (weightsOrBackend) =>
    weightsOrBackend && typeof weightsOrBackend.affine === 'function'
        ? weightsOrBackend
        : jsBackend(weightsOrBackend);

// One LSTM step over a backend: g = affine([...xSegments, h]); then gates.
const lstmCell = (backend, xSegments, c, h, kName, bName) =>
    applyGates(backend.affine([...xSegments, h], kName, bName), c);

/**
 * Encode a [NUM_STEPS][DEPTH] input (Float32Array rows) to the latent mean z.
 * Accepts a weights Map or a backend (Map is wrapped with the JS backend).
 * @returns {Float32Array} z (length 256)
 */
export const encode = (weightsOrBackend, input) => {
    const backend = resolveBackend(weightsOrBackend);

    let fc = new Float32Array(ENC_H);
    let fh = new Float32Array(ENC_H);
    for (let s = 0; s < NUM_STEPS; s++) {
        ({ c: fc, h: fh } = lstmCell(backend, [input[s]], fc, fh, W.encFwK, W.encFwB));
    }
    let bc = new Float32Array(ENC_H);
    let bh = new Float32Array(ENC_H);
    for (let s = NUM_STEPS - 1; s >= 0; s--) {
        ({ c: bc, h: bh } = lstmCell(backend, [input[s]], bc, bh, W.encBwK, W.encBwB));
    }
    const finalState = new Float32Array(2 * ENC_H);
    finalState.set(fh, 0);
    finalState.set(bh, ENC_H);
    return backend.affine([finalState], W.muK, W.muB);
};

/**
 * Decode z to a [NUM_STEPS] array of Float32Array(DEPTH) rows. Each row is the
 * sampled output: [hits(9) in {0,1}, velocities(9) in [0,1], offsets(9) in [-1,1]].
 * Deterministic (hit threshold 0.5, no temperature) for reproducible humanization.
 */
export const decode = (weightsOrBackend, z) => {
    const backend = resolveBackend(weightsOrBackend);
    const init = backend.affine([z], W.z2iK, W.z2iB);
    for (let i = 0; i < init.length; i++) init[i] = Math.tanh(init[i]);
    // split into [c0, h0, c1, h1], each DEC_H
    let c0 = init.slice(0, DEC_H);
    let h0 = init.slice(DEC_H, 2 * DEC_H);
    let c1 = init.slice(2 * DEC_H, 3 * DEC_H);
    let h1 = init.slice(3 * DEC_H, 4 * DEC_H);

    let prev = new Float32Array(DEPTH);
    const out = [];
    for (let s = 0; s < NUM_STEPS; s++) {
        // cell 0 input is the previous output concatenated with z.
        ({ c: c0, h: h0 } = lstmCell(backend, [prev, z], c0, h0, W.dec0K, W.dec0B));
        ({ c: c1, h: h1 } = lstmCell(backend, [h0], c1, h1, W.dec1K, W.dec1B));
        const o = backend.affine([h1], W.outK, W.outB);

        const sample = new Float32Array(DEPTH);
        for (let k = 0; k < NUM_CLASSES; k++) {
            sample[k] = sigmoid(o[k]) > 0.5 ? 1 : 0; // hit
            sample[NUM_CLASSES + k] = sigmoid(o[NUM_CLASSES + k]); // velocity
            sample[2 * NUM_CLASSES + k] = Math.tanh(o[2 * NUM_CLASSES + k]); // offset
        }
        out.push(sample);
        prev = sample;
    }
    return out;
};

/**
 * encode -> decode. Returns the humanized [NUM_STEPS][DEPTH] output. Accepts a
 * weights Map or a prebuilt backend; resolve once and reuse for both passes.
 */
export const humanize = (weightsOrBackend, input) => {
    const backend = resolveBackend(weightsOrBackend);
    return decode(backend, encode(backend, input));
};

// Exposed for unit testing.
export const __internals = { dense, lstmStep, sigmoid };
