// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { describe, it, expect } from 'vitest';
import { encodeGrid, decodeGrid } from './hashState';

describe('hashState', () => {
    describe('encodeGrid', () => {
        it('should return empty string for null grid', () => {
            expect(encodeGrid(null)).toBe('');
        });

        it('should return empty string for empty grid', () => {
            expect(encodeGrid([])).toBe('');
        });

        it('should encode a simple grid', () => {
            const grid = [
                [true, false, false, false],
                [false, true, false, false],
            ];
            const encoded = encodeGrid(grid);
            expect(encoded).toMatch(/^\d+\./); // Should start with column count
            expect(encoded.split('.')[0]).toBe('4'); // 4 columns
        });

        it('should encode a grid with all false values', () => {
            const grid = [
                [false, false, false, false],
                [false, false, false, false],
            ];
            const encoded = encodeGrid(grid);
            expect(encoded).toBeTruthy();
        });

        it('should encode a grid with all true values', () => {
            const grid = [
                [true, true, true, true],
                [true, true, true, true],
            ];
            const encoded = encodeGrid(grid);
            expect(encoded).toBeTruthy();
        });
    });

    describe('decodeGrid', () => {
        it('should return null for null input', () => {
            expect(decodeGrid(null, 2)).toBeNull();
        });

        it('should return null for empty string', () => {
            expect(decodeGrid('', 2)).toBeNull();
        });

        it('should return null for invalid column count', () => {
            expect(decodeGrid('invalid.abc', 2)).toBeNull();
        });

        it('should decode a valid encoded grid', () => {
            const grid = [
                [true, false, false, false],
                [false, true, false, false],
            ];
            const encoded = encodeGrid(grid);
            const decoded = decodeGrid(encoded, 2);

            expect(decoded).toHaveLength(2);
            expect(decoded[0]).toHaveLength(4);
            expect(decoded[0][0]).toBe(true);
            expect(decoded[0][1]).toBe(false);
            expect(decoded[1][0]).toBe(false);
            expect(decoded[1][1]).toBe(true);
        });
    });

    describe('roundtrip encoding/decoding', () => {
        it('should correctly roundtrip a simple pattern', () => {
            const original = [
                [true, false, true, false],
                [false, true, false, true],
            ];
            const encoded = encodeGrid(original);
            const decoded = decodeGrid(encoded, 2);

            expect(decoded).toEqual(original);
        });

        it('should correctly roundtrip a 16-step drum pattern', () => {
            const original = [
                [true, false, false, false, true, false, false, false, true, false, false, false, true, false, false, false], // Kick on 1, 5, 9, 13
                [false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, false], // Snare on 5, 13
                [true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true], // Hi-hat on every step
            ];
            const encoded = encodeGrid(original);
            const decoded = decodeGrid(encoded, 3);

            expect(decoded).toEqual(original);
        });

        it('should correctly roundtrip a grid with all true values', () => {
            const rows = 7;
            const cols = 16;
            const original = Array(rows).fill(null).map(() => Array(cols).fill(true));
            const encoded = encodeGrid(original);
            const decoded = decodeGrid(encoded, rows);

            expect(decoded).toEqual(original);
        });

        it('should correctly roundtrip a grid with all false values', () => {
            const rows = 7;
            const cols = 16;
            const original = Array(rows).fill(null).map(() => Array(cols).fill(false));
            const encoded = encodeGrid(original);
            const decoded = decodeGrid(encoded, rows);

            expect(decoded).toEqual(original);
        });

        it('should correctly roundtrip patterns with different step counts', () => {
            // 3/4 time signature (12 steps)
            const pattern12 = [
                [true, false, false, false, false, false, true, false, false, false, false, false],
                [false, false, false, true, false, false, false, false, false, true, false, false],
            ];
            expect(decodeGrid(encodeGrid(pattern12), 2)).toEqual(pattern12);

            // 5/4 time signature (20 steps)
            const pattern20 = [
                [true, false, false, false, false, false, false, false, false, false,
                    true, false, false, false, false, false, false, false, false, false],
            ];
            expect(decodeGrid(encodeGrid(pattern20), 1)).toEqual(pattern20);
        });
    });
});
