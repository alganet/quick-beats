// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { useState, useEffect, useRef, useCallback } from 'react';
import { rescaleOffsets } from '../utils/grooveConvert';
import { HUMANIZE_STYLE } from '../data/humanizeStyle';

// How long the grid must sit unedited before an auto re-humanize fires. WASM
// compute is ~5x faster, so it can react much sooner; the JS fallback waits
// longer to avoid recomputing mid-edit on the slow path.
const HUMANIZE_IDLE_MS_WASM = 1200;
const HUMANIZE_IDLE_MS_JS = 5000;

// The humanize intent layer that sits on top of the `useHumanize` model
// primitive. Owns the on/off toggle, the streamed-layer application, the idle
// re-humanize timer, the BPM rescale, the signature-change reset, and the
// derived button status. Drives the audio engine through the passed-in sinks.
//
// Inputs:
//   grid, bpmInput, timeSignature, isSetup, assetsReady — live app state
//   setPerfLayer / setHumanizeEnabled / setHumanizeOptions — useAudio sinks
//   humanize — the whole object returned by useHumanize()
// Returns what the UI needs: { humanizeStatus, humanizeActive, humanizedLayer,
//   humanizeAction, modelProgress }.
export function useHumanizeLifecycle({
    grid,
    bpmInput,
    timeSignature,
    isSetup,
    assetsReady,
    setPerfLayer,
    setHumanizeEnabled,
    setHumanizeOptions,
    humanize,
}) {
    const {
        phase: humanizePhase,
        compute: computeHumanize,
        reset: resetHumanizePhase,
        warmup: warmupModel,
        modelPhase,
        modelProgress,
        computeBackend,
    } = humanize;

    // Humanize is a plain on/off toggle. `humanizeOn` = the user's intent (engine
    // humanized). `humanizedGrid` is the grid the applied layer was computed from;
    // when the live `grid` drifts from it we're "pending" — a re-humanize is queued
    // on a 5s idle timer. Turning off keeps the last layer in memory (perfLayerRef)
    // so toggling back on is instant when nothing changed. Off is the default.
    const [humanizeOn, setHumanizeOn] = useState(false);
    const [humanizedGrid, setHumanizedGrid] = useState(null);
    // The applied perf layer in state (mirrors perfLayerRef) so the grid can tint
    // humanized hits. Updated per streamed window, so the tint fills in bar by bar.
    const [humanizedLayer, setHumanizedLayer] = useState(null);
    const idleHumanizeTimeoutRef = useRef(null);
    // Humanization: the raw performance layer + the bpm its offsets were computed
    // at, so bpm changes rescale microtiming without re-running the model.
    const perfLayerRef = useRef(null);
    const perfBpmRef = useRef(120);
    const bpmInputRef = useRef(120);
    const gridRef = useRef([]);

    // GrooVAE humanize only supports 16th-note grids (4/4, 3/4, 5/4).
    const humanizeSupported = !!timeSignature && timeSignature.stepsPerBeat === 4;

    // Start downloading the 8MB model once the grid is shown (and only for
    // supported signatures) so the first Humanize click is fast, not a download.
    // Gated on `assetsReady` so on a shared-link load the model doesn't steal
    // bandwidth from the drum-sample prefetch that gates the UX.
    useEffect(() => {
        if (assetsReady && isSetup && humanizeSupported) warmupModel();
    }, [assetsReady, isSetup, humanizeSupported, warmupModel]);

    // Humanization plays when toggled on and the signature is supported.
    const humanizeActive = humanizeOn && humanizeSupported;
    // "Pending": on, but the live grid drifted from the layer we computed (editing
    // swaps the `grid` reference) — a re-humanize is queued on the idle timer.
    const humanizePending = humanizeActive && grid.length > 0 && grid !== humanizedGrid;

    // Run the model for `g` and apply the result. The worker client supersedes by
    // request id (latest-wins), so a stale result resolves to null and is dropped.
    const runHumanize = useCallback((g) => {
        if (!g || g.length === 0) return;
        const bpm = bpmInputRef.current;
        // Apply a (partial or final) layer to the engine. Offsets are in seconds for
        // `bpm`; if the tempo changed while the worker ran, rescale to the live bpm
        // so microtiming matches playback.
        const apply = (layer) => {
            const liveBpm = bpmInputRef.current;
            const applied = liveBpm === bpm ? layer : rescaleOffsets(layer, bpm, liveBpm);
            perfLayerRef.current = applied;
            perfBpmRef.current = liveBpm;
            setPerfLayer(applied);
            setHumanizedLayer(applied); // drive the pad tint (per-window as it streams)
        };
        // Stream each window as it lands so the grid humanizes bar by bar, then
        // finalize (record the grid this layer represents) on the resolved result.
        computeHumanize(g, bpm, (partial) => { if (partial) apply(partial); }).then((layer) => {
            if (!layer) return; // failed (phase=error) or superseded by a newer call
            apply(layer);
            setHumanizedGrid(g); // the grid this layer now represents
        });
    }, [computeHumanize, setPerfLayer]);

    // The Humanize button is a toggle:
    //   off -> on : humanize now (reuse the remembered layer if it still matches)
    //   on  -> off: stop humanizing; keep the last layer in memory
    //   error     : clicking retries the compute (stays on)
    // While on, edits auto re-humanize after a 5s idle (see the effect below).
    const humanizeAction = useCallback(() => {
        if (!humanizeSupported) return;
        if (modelPhase === 'error') { // retry the model download from the error popover
            warmupModel();
            return;
        }
        if (modelPhase !== 'ready') return; // weights still downloading — ignore clicks
        if (humanizePhase === 'error') { // retry from the error popover
            runHumanize(gridRef.current);
            return;
        }
        if (humanizeOn) {
            setHumanizeOn(false); // the effect disables the engine; layer is remembered
            return;
        }
        const g = gridRef.current;
        if (!g || g.length === 0) return;
        setHumanizeOn(true);
        // Reuse a remembered layer that still matches the grid; otherwise compute now.
        if (!(perfLayerRef.current && humanizedGrid === g)) runHumanize(g);
    }, [humanizeSupported, modelPhase, warmupModel, humanizePhase, humanizeOn, humanizedGrid, runHumanize]);

    // While on, re-humanize once the grid has been idle for HUMANIZE_IDLE_MS.
    // Resetting the timer on every grid change debounces rapid edits into a single
    // model run. We never schedule while a compute is already in flight, so runs
    // can't overlap; when it finishes this effect re-runs and reschedules if the
    // grid is still pending.
    useEffect(() => {
        if (idleHumanizeTimeoutRef.current) {
            clearTimeout(idleHumanizeTimeoutRef.current);
            idleHumanizeTimeoutRef.current = null;
        }
        if (!humanizePending || humanizePhase === 'computing') return undefined;
        // WASM reacts quickly; the JS fallback waits longer (compute is ~5x slower).
        const idleMs = computeBackend === 'wasm' ? HUMANIZE_IDLE_MS_WASM : HUMANIZE_IDLE_MS_JS;
        idleHumanizeTimeoutRef.current = setTimeout(() => {
            idleHumanizeTimeoutRef.current = null;
            runHumanize(gridRef.current);
        }, idleMs);
        return () => {
            if (idleHumanizeTimeoutRef.current) {
                clearTimeout(idleHumanizeTimeoutRef.current);
                idleHumanizeTimeoutRef.current = null;
            }
        };
    }, [humanizePending, humanizePhase, grid, runHumanize, computeBackend]);

    // Discard humanization entirely. Used when the user switches time signature —
    // they're writing a different beat, so carrying the old groove (or its
    // remembered layer) makes no sense.
    const resetHumanization = useCallback(() => {
        if (idleHumanizeTimeoutRef.current) {
            clearTimeout(idleHumanizeTimeoutRef.current);
            idleHumanizeTimeoutRef.current = null;
        }
        setHumanizeOn(false);
        setHumanizedGrid(null);
        setHumanizedLayer(null);
        perfLayerRef.current = null;
        perfBpmRef.current = bpmInputRef.current;
        setPerfLayer(null);
        resetHumanizePhase();
    }, [setPerfLayer, resetHumanizePhase]);

    // Any time-signature change (new beat from Setup, or Home -> null) wipes the
    // humanization. Keyed on the signature object, which only changes on confirm /
    // reset, so editing the grid never trips this.
    const prevSigRef = useRef(timeSignature);
    useEffect(() => {
        if (prevSigRef.current === timeSignature) return;
        prevSigRef.current = timeSignature;
        resetHumanization();
    }, [timeSignature, resetHumanization]);

    // Mirror live values into refs so the click action reads fresh state.
    useEffect(() => { bpmInputRef.current = bpmInput; }, [bpmInput]);
    useEffect(() => { gridRef.current = grid; }, [grid]);

    // Drive the engine: humanized when active, flat (gain 1, no offset) otherwise.
    useEffect(() => {
        setHumanizeEnabled(humanizeActive);
    }, [humanizeActive, setHumanizeEnabled]);

    useEffect(() => {
        setHumanizeOptions(HUMANIZE_STYLE);
    }, [setHumanizeOptions]);

    // Rescale microtiming when bpm changes — cheap, no model run, no recompute.
    useEffect(() => {
        if (!humanizeOn) return;
        const layer = perfLayerRef.current;
        if (!layer || perfBpmRef.current === bpmInput) return;
        const rescaled = rescaleOffsets(layer, perfBpmRef.current, bpmInput);
        perfLayerRef.current = rescaled;
        perfBpmRef.current = bpmInput;
        setPerfLayer(rescaled);
    }, [bpmInput, humanizeOn, setPerfLayer]);

    // Button status for the UI (see HumanizeButton).
    //   computing : a model run is in flight (first humanize OR a background
    //               re-humanize) -> spinner
    //   pending   : on, grid drifted, waiting on the idle timer to fire -> "!"
    //   on        : humanized and up to date
    //   loading   : the model (weights.bin) is still downloading -> progress ring
    const humanizeStatus = !humanizeSupported
        ? 'unavailable'
        : modelPhase === 'error'
            ? 'error'
            : modelPhase !== 'ready'
                ? 'loading'
                : humanizePhase === 'error'
                    ? 'error'
                    : !humanizeOn
                        ? 'off'
                        : humanizePhase === 'computing'
                            ? 'computing'
                            : humanizePending
                                ? 'pending'
                                : 'on';

    return { humanizeStatus, humanizeActive, humanizedLayer, humanizeAction, modelProgress };
}
