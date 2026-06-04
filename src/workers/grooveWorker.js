// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

// Runs the GrooVAE humanization off the main thread so the UI and audio
// scheduling never stall. Weights are fetched + dequantized inside the worker
// (once), and each message computes a performance layer for the given grid.

import { loadWeights } from '../utils/grooveWeights';
import { computePerfLayer } from '../utils/grooveConvert';

let weightsPromise = null;

self.onmessage = async (e) => {
    const msg = e.data || {};

    // Warmup: download + dequantize the weights ahead of the first humanize,
    // streaming progress back so the UI can show a ready-up indicator. Shares
    // `weightsPromise` with compute, so a later compute reuses these weights.
    if (msg.type === 'warmup') {
        try {
            if (!weightsPromise) {
                weightsPromise = loadWeights(undefined, (progress) =>
                    self.postMessage({ type: 'progress', progress }),
                );
            }
            await weightsPromise;
            self.postMessage({ type: 'ready' });
        } catch (err) {
            weightsPromise = null; // allow retry after a transient failure (e.g. offline)
            self.postMessage({ type: 'error', error: String((err && err.message) || err) });
        }
        return;
    }

    const { id, grid, bpm } = msg;
    try {
        if (!weightsPromise) weightsPromise = loadWeights();
        const weights = await weightsPromise;
        const perf = computePerfLayer(weights, grid, bpm);
        self.postMessage({ id, perf });
    } catch (err) {
        weightsPromise = null; // allow retry after a transient failure (e.g. offline)
        self.postMessage({ id, error: String((err && err.message) || err) });
    }
};
