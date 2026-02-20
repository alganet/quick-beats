// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { startTransition, useEffect, useState, useRef, useCallback } from "react";
import * as Tone from "tone";
import { KITS, INSTRUMENTS, DEFAULT_KIT_ID } from "../data/kit";

export function useAudio() {
    const [isLoaded, setIsLoaded] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentStep, setCurrentStep] = useState(0);
    const [activeKit, setActiveKit] = useState(DEFAULT_KIT_ID);
    const players = useRef(null);
    const sequence = useRef(null);
    const gridRef = useRef([]);
    const stepRef = useRef(0);
    const isLoadedRef = useRef(false);
    const perfTickRef = useRef(0);
    const wakeLockRef = useRef(null);
    const playheadVersionRef = useRef(0);

    const loadKit = useCallback(async (kitId) => {
        const kit = KITS[kitId];
        if (!kit) return;

        setIsLoaded(false);
        isLoadedRef.current = false;
        if (players.current) {
            players.current.dispose();
        }

        const resolvedSamples = {};
        Object.entries(kit.samples).forEach(([name, path]) => {
            // Remove leading slash if present and prepend BASE_URL
            const cleanPath = path.startsWith('/') ? path.slice(1) : path;
            resolvedSamples[name] = `${import.meta.env.BASE_URL}${cleanPath}`;
        });

        const newPlayers = new Tone.Players(resolvedSamples).toDestination();
        players.current = newPlayers;

        await Tone.loaded();
        setIsLoaded(true);
        isLoadedRef.current = true;
        setActiveKit(kitId);
    }, []);

    // Ensure players are cleaned up on unmount. Kit loading is done lazily
    // to avoid creating/resuming an AudioContext before a user gesture (browser
    // autoplay policy triggers a console warning otherwise).
    useEffect(() => {
        return () => {
            if (players.current) players.current.dispose();
        };
    }, []);

    const updateGrid = useCallback((newGrid) => {
        gridRef.current = newGrid;
    }, []);

    const togglePlay = useCallback(async () => {
        // Lazy-load the default kit on first user-driven playback so we don't
        // create or resume the AudioContext during page load (avoids browser
        // autoplay warnings).
        if (!isLoadedRef.current) {
            await loadKit(DEFAULT_KIT_ID);
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

            // Trigger sounds for this step
            INSTRUMENTS.forEach((instrument, rowIndex) => {
                if (currentGrid[rowIndex] && currentGrid[rowIndex][step]) {
                    if (players.current && players.current.has(instrument)) {
                        try {
                            players.current.player(instrument).start(time, 0);
                        } catch {
                            console.warn("Skipped a beat due to audio playback isssue");
                        }
                    }
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
        if (players.current.has(instrument)) {
            players.current.player(instrument).start();
        }
    }, [isLoaded]);

    return { isLoaded, isPlaying, currentStep, activeKit, loadKit, togglePlay, setBpm, updateGrid, setStep, playNote };
}
