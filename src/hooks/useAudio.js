// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { useEffect, useState, useRef, useCallback } from "react";
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

    const loadKit = useCallback(async (kitId) => {
        const kit = KITS[kitId];
        if (!kit) return;

        setIsLoaded(false);
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
        setActiveKit(kitId);
    }, []);

    // Initial load
    useEffect(() => {
        queueMicrotask(() => {
            loadKit(DEFAULT_KIT_ID);
        });
        return () => {
            if (players.current) players.current.dispose();
        };
    }, [loadKit]);

    const updateGrid = useCallback((newGrid) => {
        gridRef.current = newGrid;
    }, []);

    const togglePlay = async () => {
        if (!isLoaded) return;

        if (Tone.getTransport().state === "started") {
            Tone.getTransport().stop();
            setIsPlaying(false);
            setCurrentStep(0);
            stepRef.current = 0; // Reset step ref
        } else {
            await Tone.start();
            Tone.getTransport().start();
            setIsPlaying(true);
        }
    };

    const setBpm = (bpm) => {
        Tone.getTransport().bpm.value = bpm;
    };

    useEffect(() => {
        // Use a Loop instead of Sequence to handle dynamic grid lengths
        const loop = new Tone.Loop((time) => {
            const currentGrid = gridRef.current;
            if (!currentGrid || currentGrid.length === 0) return;

            const totalSteps = currentGrid[0]?.length || 16;
            const step = stepRef.current; // Read current step

            // Trigger sounds for this step
            INSTRUMENTS.forEach((instrument, rowIndex) => {
                if (currentGrid[rowIndex] && currentGrid[rowIndex][step]) {
                    if (players.current && players.current.has(instrument)) {
                        players.current.player(instrument).start(time, 0);
                    }
                }
            });

            // Schedule UI update
            Tone.getDraw().schedule(() => {
                setCurrentStep(step);
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
        stepRef.current = step;
        setCurrentStep(step);
    }, []);

    const playNote = useCallback((instrument) => {
        if (!isLoaded || !players.current) return;
        if (players.current.has(instrument)) {
            players.current.player(instrument).start(Tone.now());
        }
    }, [isLoaded]);

    return { isLoaded, isPlaying, currentStep, activeKit, loadKit, togglePlay, setBpm, updateGrid, setStep, playNote };
}
