// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { useCallback, useRef, useState } from 'react';
import { computeHumanization, warmupWeights } from '../utils/grooveClient';

/**
 * GrooVAE model lifecycle: a `compute` that runs the model in a Web Worker
 * (never blocking the main thread or audio scheduling) plus a `phase` for the
 * UI. The App owns the on/off/dirty intent and decides when to call `compute`
 * (it's triggered only by the user pressing the Humanize button).
 *
 * phase: 'idle' | 'computing' | 'ready' | 'error'
 *
 * Separately tracks the one-time model (weights.bin) download so the App can
 * start it as soon as the grid is shown and reflect progress on the button:
 * modelPhase: 'idle' | 'loading' | 'ready' | 'error', modelProgress: 0..1.
 */
export function useHumanize() {
    const [phase, setPhase] = useState('idle');
    const reqIdRef = useRef(0);
    const [modelPhase, setModelPhase] = useState('idle');
    const [modelProgress, setModelProgress] = useState(0);
    const warmStartedRef = useRef(false);

    /**
     * Begin (or retry) the background weight download. Idempotent while loading
     * or ready; a previous error resets so this re-attempts.
     */
    const warmup = useCallback(() => {
        if (warmStartedRef.current) return;
        warmStartedRef.current = true;
        setModelProgress(0); // reset so a retry doesn't flash the prior attempt's percent
        setModelPhase('loading');
        warmupWeights((p) => setModelProgress(p))
            .then(() => {
                setModelProgress(1);
                setModelPhase('ready');
            })
            .catch(() => {
                warmStartedRef.current = false; // allow a retry
                setModelPhase('error');
            });
    }, []);

    /**
     * Compute the performance layer off the main thread. Resolves to the layer,
     * or null if there's nothing to humanize or a newer compute superseded this
     * one (latest-wins). Never throws.
     */
    const compute = useCallback(async (grid, bpm) => {
        if (!grid || grid.length === 0 || !grid[0] || grid[0].length === 0) {
            return null;
        }
        const id = ++reqIdRef.current;
        setPhase('computing');
        try {
            const perf = await computeHumanization(grid, bpm);
            if (id !== reqIdRef.current) return null; // superseded
            setPhase('ready');
            return perf;
        } catch {
            if (id === reqIdRef.current) setPhase('error');
            return null;
        }
    }, []);

    /**
     * Cancel any in-flight compute (its result is dropped — latest-wins by id)
     * and return to the idle phase. Used when humanization is discarded, e.g. on
     * a time-signature change.
     */
    const reset = useCallback(() => {
        reqIdRef.current += 1;
        setPhase('idle');
    }, []);

    return { phase, compute, reset, warmup, modelPhase, modelProgress };
}
