// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { startTransition, useEffect, useState, useRef, useCallback } from "react";
import * as Tone from "tone";
import { KITS, INSTRUMENTS, DEFAULT_KIT_ID } from "../data/kit";
import { prefetchKitSamples, sampleUrl } from "../utils/preloadSamples";

export function useAudio(initialKitId = DEFAULT_KIT_ID) {
    const [isLoaded, setIsLoaded] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentStep, setCurrentStep] = useState(0);
    const [activeKit, setActiveKit] = useState(initialKitId);
    // Mirror of activeKit for the togglePlay/loadKit closures (lazy first play
    // and the no-op switch guard read it without re-subscribing).
    const activeKitRef = useRef(initialKitId);
    // Monotonic token so a newer switch always wins: a stale load that resolves
    // late discards its freshly-built chains instead of clobbering the new kit.
    const switchTokenRef = useRef(0);
    // Cleared on unmount so an in-flight switch that resolves afterwards disposes
    // its freshly-built chains instead of installing orphaned (un-disposable) ones.
    const mountedRef = useRef(true);
    const players = useRef(null);
    const sequence = useRef(null);
    const gridRef = useRef([]);
    const stepRef = useRef(0);
    const isLoadedRef = useRef(false);
    const perfTickRef = useRef(0);
    const wakeLockRef = useRef(null);
    const playheadVersionRef = useRef(0);
    // Humanization "performance layer" applied non-destructively at playback.
    // perfLayerRef.current[row][step] = null | { vel: 0..1, offsetSec }
    const perfLayerRef = useRef(null);
    const humanizeOnRef = useRef(false);
    // Style scalars (see data/humanizeStyle). Used only to (re)build appliedLayerRef.
    const humanizeOptionsRef = useRef({ timing: 1, velocity: 1 });
    // Precomputed per-hit playback values { gain, offsetSec } | null — built off the
    // audio thread so the loop reads, never computes.
    const appliedLayerRef = useRef(null);

    const disposeChains = useCallback((chains) => {
        if (!chains) return;
        Object.values(chains).forEach(({ player, gain }) => {
            try { player?.dispose?.(); } catch { /* ignore */ }
            try { gain?.dispose?.(); } catch { /* ignore */ }
        });
    }, []);

    // Build one Player -> Gain -> destination chain per instrument so we can apply
    // a per-hit gain (velocity) when humanization is on (a single Tone.Players has
    // no per-hit gain). Returns { [name]: { player, gain, lastGain } } WITHOUT
    // installing it, so the caller can decode before an atomic swap.
    const buildChains = useCallback((kit) => {
        const chains = {};
        Object.entries(kit.samples).forEach(([name, path]) => {
            // Same URL the prefetch warmed, so the player loads from cache.
            const gain = new Tone.Gain(1).toDestination();
            const player = new Tone.Player(sampleUrl(path)).connect(gain);
            // Track the last-applied gain so the loop only writes the Web Audio gain
            // param when it actually changes (a flat beat then just .start()s).
            chains[name] = { player, gain, lastGain: 1 };
        });
        return chains;
    }, []);

    // Load (or switch to) a kit. Switching is GAPLESS: the currently-playing kit
    // keeps sounding while the new samples download + decode, and is only swapped
    // out — and disposed — once the new chains are ready. Concurrent switches are
    // last-wins via switchTokenRef. `onProgress(0..1)` mirrors the prefetch.
    //
    // Never rejects — every failure keeps the current kit playing — so the
    // outcome is the resolved value: 'ok' (the kit is installed and sounding),
    // 'failed' (a sample refused to load; the old kit kept playing), or
    // 'superseded' (a newer switch overtook this one, which announces itself).
    const loadKit = useCallback(async (kitId, onProgress) => {
        const kit = KITS[kitId];
        if (!kit) return 'failed';

        // Already on this kit and loaded: nothing to do.
        if (kitId === activeKitRef.current && isLoadedRef.current) {
            onProgress?.(1);
            return 'ok';
        }

        const token = ++switchTokenRef.current;

        // Warm the HTTP cache first — this is what drives the 0..1 progress. The
        // build below then decodes from cache, fast. Old players stay live.
        await prefetchKitSamples(kitId, onProgress);
        if (token !== switchTokenRef.current) return 'superseded'; // mid-download

        const chains = buildChains(kit);
        try {
            await Tone.loaded();
        } catch {
            // A sample failed to load/decode: drop the half-built kit and keep the
            // current one playing (the gapless contract). Never leak the new nodes,
            // and never let the rejection escape to wedge togglePlay/handleSelectKit.
            disposeChains(chains);
            return 'failed';
        }

        // A newer switch started while we decoded, or we unmounted — drop ours.
        if (token !== switchTokenRef.current || !mountedRef.current) {
            disposeChains(chains);
            return 'superseded';
        }

        // Atomic swap: install the new kit, then dispose the previous one so the
        // playback loop never observes a missing chain.
        const previous = players.current;
        players.current = chains;
        disposeChains(previous);

        activeKitRef.current = kitId;
        setActiveKit(kitId);
        setIsLoaded(true);
        isLoadedRef.current = true;
        onProgress?.(1);
        return 'ok';
    }, [buildChains, disposeChains]);

    // Ensure players are cleaned up on unmount. Kit loading is done lazily
    // to avoid creating/resuming an AudioContext before a user gesture (browser
    // autoplay policy triggers a console warning otherwise).
    useEffect(() => {
        // Set in setup (not just cleared in cleanup) so StrictMode's
        // setup→cleanup→setup cycle leaves it true, not stuck false.
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            disposeChains(players.current);
            players.current = null;
        };
    }, [disposeChains]);

    const updateGrid = useCallback((newGrid) => {
        gridRef.current = newGrid;
    }, []);

    const togglePlay = useCallback(async () => {
        // Lazy-load the preferred kit on first user-driven playback so we don't
        // create or resume the AudioContext during page load (avoids browser
        // autoplay warnings). activeKitRef carries any restored/persisted kit.
        if (!isLoadedRef.current) {
            await loadKit(activeKitRef.current);
        }

        if (Tone.getTransport().state === "started") {
            // Invalidate any already queued UI updates from the previous
            // transport timeline before stopping.
            playheadVersionRef.current += 1;
            // Pause playback but preserve the current playhead position so resume
            // continues from the same step. `handleReset` is responsible for
            // explicitly resetting to step 0.
            Tone.getTransport().stop();
            setIsPlaying(false);
        } else {
            await Tone.start();
            Tone.getTransport().start();
            setIsPlaying(true);
        }
    }, [loadKit]);

    const setBpm = useCallback((bpm) => {
        Tone.getTransport().bpm.value = bpm;
    }, []);

    // Keep the screen awake while the sequencer is playing (Screen Wake Lock API - best-effort)
    useEffect(() => {
        let visibilityHandler;

        const requestWakeLock = async () => {
            if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
            try {
                const sentinel = await navigator.wakeLock.request('screen');
                wakeLockRef.current = sentinel;
                if (sentinel && typeof sentinel.addEventListener === 'function') {
                    sentinel.addEventListener('release', () => { wakeLockRef.current = null; });
                }
            } catch {
                // best-effort; ignore failures
            }
        };

        const releaseWakeLock = async () => {
            if (wakeLockRef.current && typeof wakeLockRef.current.release === 'function') {
                try { await wakeLockRef.current.release(); } catch { /* ignore */ }
                wakeLockRef.current = null;
            }
        };

        if (isPlaying) {
            requestWakeLock();
            visibilityHandler = () => {
                if (!document.hidden && isPlaying && !wakeLockRef.current) requestWakeLock();
            };
            document.addEventListener('visibilitychange', visibilityHandler);
        } else {
            // ensure lock is released when playback stops
            releaseWakeLock();
        }

        return () => {
            if (visibilityHandler) document.removeEventListener('visibilitychange', visibilityHandler);
            releaseWakeLock();
        };
    }, [isPlaying]);

    useEffect(() => {
        // Use a Loop instead of Sequence to handle dynamic grid lengths
        const loop = new Tone.Loop((time) => {
            const currentGrid = gridRef.current;
            if (!currentGrid || currentGrid.length === 0) return;

            const totalSteps = currentGrid[0]?.length || 16;
            const step = stepRef.current; // Read current step
            const perfEnabled = import.meta.env.DEV
                && typeof window !== "undefined"
                && window.__QB_PERF__ === true
                && typeof performance !== "undefined"
                && typeof performance.mark === "function"
                && typeof performance.measure === "function";

            let audioMarkName;
            let uiMarkName;
            let measureName;
            if (perfEnabled) {
                const tickId = perfTickRef.current++;
                audioMarkName = `qb-audio-${tickId}`;
                uiMarkName = `qb-ui-${tickId}`;
                measureName = `qb-audio-to-ui-${tickId}`;
                performance.mark(audioMarkName);
            }

            // Trigger sounds for this step. Hot path is intentionally tiny: read a
            // PRECOMPUTED per-hit value (no humanize math here), write a Web Audio
            // param only when it actually changes, then start the sample.
            const layer = humanizeOnRef.current ? appliedLayerRef.current : null;
            // "Never schedule in the past" floor — the raw context time. NOT now(),
            // which adds the lookAhead and would shove every hit forward (see the
            // immediate()-vs-now() regression test in useAudio.test.js).
            const earliest = layer ? Tone.immediate() : 0;
            INSTRUMENTS.forEach((instrument, rowIndex) => {
                if (!(currentGrid[rowIndex] && currentGrid[rowIndex][step])) return;
                const chain = players.current && players.current[instrument];
                if (!chain) return;
                try {
                    const a = layer && layer[rowIndex] && layer[rowIndex][step];
                    if (a) {
                        let when = time + a.offsetSec;
                        if (when < earliest) when = earliest; // never schedule in the past
                        if (chain.lastGain !== a.gain) {
                            chain.gain.gain.setValueAtTime(a.gain, when);
                            chain.lastGain = a.gain;
                        }
                        chain.player.start(when, 0);
                    } else {
                        // Flat playback: restore resting (full) gain only if needed.
                        if (chain.lastGain !== 1) {
                            chain.gain.gain.setValueAtTime(1, time);
                            chain.lastGain = 1;
                        }
                        chain.player.start(time, 0);
                    }
                } catch {
                    console.warn("Skipped a beat due to audio playback issue");
                }
            });

            // Schedule UI update
            const scheduledPlayheadVersion = playheadVersionRef.current;
            Tone.getDraw().schedule(() => {
                // Ignore stale scheduled updates after a manual seek/stop.
                if (scheduledPlayheadVersion !== playheadVersionRef.current) return;

                if (perfEnabled) {
                    performance.mark(uiMarkName);
                    performance.measure(measureName, audioMarkName, uiMarkName);
                    performance.clearMarks(audioMarkName);
                    performance.clearMarks(uiMarkName);
                    performance.clearMeasures(measureName);
                }

                startTransition(() => {
                    setCurrentStep((previousStep) => (previousStep === step ? previousStep : step));
                });
            }, time);

            // Increment for next loop
            stepRef.current = (step + 1) % totalSteps;

        }, "16n");

        loop.start(0);
        sequence.current = loop;

        return () => {
            loop.dispose();
        };
    }, []);

    const setStep = useCallback((step) => {
        // Invalidate queued draw updates from the previous timeline position.
        playheadVersionRef.current += 1;
        stepRef.current = step;
        setCurrentStep(step);
    }, []);

    const playNote = useCallback((instrument) => {
        if (!isLoaded || !players.current) return;
        const chain = players.current[instrument];
        if (chain) {
            chain.gain.gain.setValueAtTime(1, Tone.now());
            chain.lastGain = 1;
            chain.player.start();
        }
    }, [isLoaded]);

    // Humanization wiring (set by the App via useHumanize). The loop reads these
    // refs directly so updates don't trigger React re-renders.
    //
    // All per-hit shaping (velocity blend, timing scale) is precomputed HERE —
    // off the audio thread — into appliedLayerRef, so the Tone.Loop callback does
    // no humanize arithmetic. Rebuilt only when the performance layer or the style
    // options change (rare: on humanize / bpm / style change), never per tick.
    const buildAppliedLayer = useCallback(() => {
        const perf = perfLayerRef.current;
        if (!perf) {
            appliedLayerRef.current = null;
            return;
        }
        const o = humanizeOptionsRef.current;
        appliedLayerRef.current = perf.map((row) =>
            row.map((cell) => {
                if (!cell) return null;
                let gain = 1 + (cell.vel - 1) * o.velocity;
                gain = gain < 0 ? 0 : gain > 1 ? 1 : gain;
                return { gain, offsetSec: cell.offsetSec * o.timing };
            }),
        );
    }, []);

    const setPerfLayer = useCallback((layer) => {
        perfLayerRef.current = layer;
        buildAppliedLayer();
    }, [buildAppliedLayer]);

    const setHumanizeEnabled = useCallback((on) => {
        humanizeOnRef.current = !!on;
    }, []);

    const setHumanizeOptions = useCallback((opts) => {
        humanizeOptionsRef.current = {
            timing: opts?.timing ?? 1,
            velocity: opts?.velocity ?? 1,
        };
        buildAppliedLayer();
    }, [buildAppliedLayer]);

    return {
        isLoaded, isPlaying, currentStep, activeKit, loadKit, togglePlay, setBpm,
        updateGrid, setStep, playNote, setPerfLayer, setHumanizeEnabled, setHumanizeOptions,
    };
}
