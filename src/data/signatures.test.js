// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { describe, it, expect } from 'vitest';
import { COMMON_SIGNATURES } from './signatures';

describe('signatures data', () => {
    describe('COMMON_SIGNATURES', () => {
        it('should be a non-empty array', () => {
            expect(Array.isArray(COMMON_SIGNATURES)).toBe(true);
            expect(COMMON_SIGNATURES.length).toBeGreaterThan(0);
        });

        it('should contain 4/4 time signature', () => {
            const fourFour = COMMON_SIGNATURES.find(s => s.name === '4/4');
            expect(fourFour).toBeDefined();
            expect(fourFour.beats).toBe(4);
            expect(fourFour.stepsPerBeat).toBe(4);
        });

        it('should contain 3/4 time signature', () => {
            const threeFour = COMMON_SIGNATURES.find(s => s.name === '3/4');
            expect(threeFour).toBeDefined();
            expect(threeFour.beats).toBe(3);
        });

        it('should contain 6/8 time signature', () => {
            const sixEight = COMMON_SIGNATURES.find(s => s.name === '6/8');
            expect(sixEight).toBeDefined();
            expect(sixEight.beats).toBe(6);
            expect(sixEight.stepsPerBeat).toBe(2);
        });

        it('each signature should have required properties', () => {
            COMMON_SIGNATURES.forEach(sig => {
                expect(sig.name).toBeDefined();
                expect(typeof sig.name).toBe('string');
                expect(sig.beats).toBeDefined();
                expect(typeof sig.beats).toBe('number');
                expect(sig.stepsPerBeat).toBeDefined();
                expect(typeof sig.stepsPerBeat).toBe('number');
                expect(sig.grouping).toBeDefined();
                expect(typeof sig.grouping).toBe('number');
                expect(sig.label).toBeDefined();
                expect(typeof sig.label).toBe('string');
                expect(sig.description).toBeDefined();
                expect(typeof sig.description).toBe('string');
            });
        });

        it('should have unique names', () => {
            const names = COMMON_SIGNATURES.map(s => s.name);
            const uniqueNames = [...new Set(names)];
            expect(names.length).toBe(uniqueNames.length);
        });

        it('should calculate correct total steps per measure', () => {
            const fourFour = COMMON_SIGNATURES.find(s => s.name === '4/4');
            expect(fourFour.beats * fourFour.stepsPerBeat).toBe(16);

            const threeFour = COMMON_SIGNATURES.find(s => s.name === '3/4');
            expect(threeFour.beats * threeFour.stepsPerBeat).toBe(12);

            const sixEight = COMMON_SIGNATURES.find(s => s.name === '6/8');
            expect(sixEight.beats * sixEight.stepsPerBeat).toBe(12);
        });
    });
});
