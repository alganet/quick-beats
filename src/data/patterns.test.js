// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { describe, it, expect } from 'vitest';
import { BACKBEATS } from './patterns';
import { COMMON_SIGNATURES } from './signatures';
import { INSTRUMENTS } from './kit';

describe('patterns data', () => {
    describe('BACKBEATS', () => {
        it('should be a non-empty object', () => {
            expect(typeof BACKBEATS).toBe('object');
            expect(Object.keys(BACKBEATS).length).toBeGreaterThan(0);
        });

        it('should have patterns for each common signature', () => {
            COMMON_SIGNATURES.forEach(sig => {
                expect(BACKBEATS[sig.name]).toBeDefined();
            });
        });

        it('each pattern should have a tempo', () => {
            Object.entries(BACKBEATS).forEach(([_name, pattern]) => {
                expect(pattern.tempo).toBeDefined();
                expect(typeof pattern.tempo).toBe('number');
                expect(pattern.tempo).toBeGreaterThan(0);
                expect(pattern.tempo).toBeLessThanOrEqual(300); // Reasonable BPM range
            });
        });

        it('each pattern should have a rhythm object', () => {
            Object.entries(BACKBEATS).forEach(([_name, pattern]) => {
                expect(pattern.rhythm).toBeDefined();
                expect(typeof pattern.rhythm).toBe('object');
            });
        });

        it('rhythm instruments should match kit instruments', () => {
            Object.entries(BACKBEATS).forEach(([_name, pattern]) => {
                Object.keys(pattern.rhythm).forEach(instrument => {
                    expect(INSTRUMENTS).toContain(instrument);
                });
            });
        });

        it('rhythm step indices should be non-negative integers', () => {
            Object.entries(BACKBEATS).forEach(([_name, pattern]) => {
                Object.entries(pattern.rhythm).forEach(([_instrument, steps]) => {
                    expect(Array.isArray(steps)).toBe(true);
                    steps.forEach(step => {
                        expect(Number.isInteger(step)).toBe(true);
                        expect(step).toBeGreaterThanOrEqual(0);
                    });
                });
            });
        });

        it('4/4 pattern should have standard backbeat structure', () => {
            const pattern = BACKBEATS['4/4'];
            expect(pattern.rhythm['Kick']).toContain(0); // Kick on beat 1
            expect(pattern.rhythm['Snare']).toContain(4); // Snare on beat 2
            expect(pattern.rhythm['Snare']).toContain(12); // Snare on beat 4
        });

        it('rhythm steps should be within measure bounds', () => {
            Object.entries(BACKBEATS).forEach(([sigName, pattern]) => {
                const sig = COMMON_SIGNATURES.find(s => s.name === sigName);
                if (sig) {
                    const totalSteps = sig.beats * sig.stepsPerBeat;
                    Object.entries(pattern.rhythm).forEach(([_instrument, steps]) => {
                        steps.forEach(step => {
                            expect(step).toBeLessThan(totalSteps);
                        });
                    });
                }
            });
        });
    });
});
