// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { describe, it, expect } from 'vitest';
import { encodeGrid, decodeGrid, buildShareHash, parseShareHash, parseInitialHash } from './hashState';
import { MIN_BPM, MAX_BPM, MAX_GRID_COLS } from '../data/sequencerConfig';

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
            expect(encodeGrid(grid)).toBe('4.AA');
        });

        it('should encode a grid with all true values', () => {
            const grid = [
                [true, true, true, true],
                [true, true, true, true],
            ];
            expect(encodeGrid(grid)).toBe('4._w');
        });
    });

    // Every other test in this file round-trips the codec against itself, which
    // cannot catch a change to the wire format: flip the bit order, swap the
    // row/column nesting, or alter the URL-safe alphabet and all of them still
    // pass while every link anyone has ever shared decodes to a different beat.
    // These are frozen outputs. If one fails, the format changed — that is a
    // breaking change to existing share links, not a test to update.
    describe('wire format (golden vectors)', () => {
        it.each([
            ['a hit on row 0 step 0 and row 1 step 1', [[true, false, false, false], [false, true, false, false]], '4.hA'],
            ['an empty two-row grid', [[false, false, false, false], [false, false, false, false]], '4.AA'],
            ['a full two-row grid', [[true, true, true, true], [true, true, true, true]], '4._w'],
            ['a four-on-the-floor sixteenth row', [[true, false, false, false, true, false, false, false, true, false, false, false, true, false, false, false]], '16.iIg'],
        ])('encodes %s as the documented token', (_label, grid, expected) => {
            expect(encodeGrid(grid)).toBe(expected);
        });

        it('decodes the documented tokens back to their grids', () => {
            expect(decodeGrid('4.hA', 2)).toEqual([
                [true, false, false, false],
                [false, true, false, false],
            ]);
            expect(decodeGrid('16.iIg', 1)).toEqual([
                [true, false, false, false, true, false, false, false, true, false, false, false, true, false, false, false],
            ]);
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

        it('should return null for corrupt base64 data and log error', () => {
            // Valid format but corrupt base64 that throws in atob
            // Use a properly formatted string but with invalid base64 content
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            
            expect(decodeGrid('4.!!!invalidbase64', 2)).toBeNull();
            
            expect(consoleSpy).toHaveBeenCalled();
            consoleSpy.mockRestore();
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

    // The grid segment arrives from the address bar, so it has to survive being
    // hand-edited, truncated by a chat client, or crafted. Every case here
    // returns null rather than throwing: App.jsx calls parseInitialHash at
    // module scope, outside React and outside ErrorBoundary, so anything that
    // throws is a white screen with no recovery.
    describe('decodeGrid rejects hostile input', () => {
        it('returns null for a segment with no dot instead of throwing', () => {
            // Regression: base64 was undefined here and `.replace` ran outside
            // the try block. 'invalidgrid' survived only because parseInt gave
            // NaN first — anything starting with a digit crashed the app.
            expect(() => decodeGrid('4invalid', 2)).not.toThrow();
            expect(decodeGrid('4invalid', 2)).toBeNull();
        });

        it('returns null for a column count with no payload at all', () => {
            expect(decodeGrid('4.', 2)).toBeNull();
            expect(decodeGrid('4', 2)).toBeNull();
        });

        it.each([
            ['zero columns', '0.AAAA'],
            ['negative columns', '-4.AAAA'],
        ])('returns null for %s', (_label, encoded) => {
            // These used to decode to a grid of empty rows, which renders as a
            // sequencer with no steps at all.
            expect(decodeGrid(encoded, 2)).toBeNull();
        });

        it('returns null for a column count past the cap rather than allocating it', () => {
            // Unbounded, this allocated a 7 x 2,000,000 grid from a URL in a few
            // hundred milliseconds. Larger values just hang the tab.
            expect(decodeGrid(`${MAX_GRID_COLS + 1}.AA`, 7)).toBeNull();
            expect(decodeGrid('2000000.AA', 7)).toBeNull();
        });

        it('accepts a column count exactly at the cap', () => {
            const row = Array(MAX_GRID_COLS).fill(false);
            const decoded = decodeGrid(encodeGrid([row]), 1);
            expect(decoded[0]).toHaveLength(MAX_GRID_COLS);
        });

        it('returns null for a payload shorter than the grid it claims', () => {
            // A truncated link used to pad with `false` and load as a valid but
            // half-empty beat, which reads as the app losing the user's work.
            expect(decodeGrid('4.AA', 3)).toBeNull();
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

    describe('share hash helpers', () => {
        it('builds and parses a full share hash (with kit + version)', () => {
            const rows = 3;
            const cols = 16;
            const grid = Array.from({ length: rows }, () => Array.from({ length: cols }, () => false));
            grid[0][0] = true;

            const hash = buildShareHash({ bpm: 120, sigName: '4/4', kitId: 'black-pearl', grid });
            expect(hash).toMatch(/^120\|4\/4\|black-pearl\|\d+\./);

            const parsed = parseShareHash(hash, rows);
            expect(parsed).not.toBeNull();
            expect(parsed.bpm).toBe(120);
            expect(parsed.sigName).toBe('4/4');
            expect(parsed.kitId).toBe('black-pearl');
            expect(parsed.grid).toEqual(grid);
        });

        it('parses legacy short format (no kit segment)', () => {
            const rows = 2;
            const grid = [
                [true, false, false, false],
                [false, true, false, false],
            ];
            const encodedGrid = encodeGrid(grid);
            const shortHash = `120|4/4|${encodedGrid}`;

            const parsed = parseShareHash(shortHash, rows);
            expect(parsed).not.toBeNull();
            expect(parsed.bpm).toBe(120);
            expect(parsed.sigName).toBe('4/4');
            expect(parsed.kitId).toBe('black-pearl');
            expect(parsed.grid).toEqual(grid);
        });

        it('parses 4-part format (bpm|sig|kit|grid)', () => {
            const rows = 2;
            const grid = [
                [true, false, false, false, true, false, false, false],
                [false, true, false, false, false, true, false, false],
            ];
            const encodedGrid = encodeGrid(grid);
            // 4 parts: bpm, sigName, kitId, grid
            const hash = `130|5/4|custom-kit|${encodedGrid}`;

            const parsed = parseShareHash(hash, rows);
            expect(parsed).not.toBeNull();
            expect(parsed.bpm).toBe(130);
            expect(parsed.sigName).toBe('5/4');
            expect(parsed.kitId).toBe('custom-kit');
            expect(parsed.grid).toEqual(grid);
        });

        it('returns null for invalid bpm', () => {
            const hash = 'abc|4/4|4.abc';
            expect(parseShareHash(hash, 2)).toBeNull();
        });

        it('returns null for hash with fewer than 3 parts', () => {
            expect(parseShareHash('120', 2)).toBeNull();
            expect(parseShareHash('120|4/4', 2)).toBeNull();
        });

        it('parses 4-part format with version (bpm|sig|grid|v1)', () => {
            const rows = 2;
            const grid = [[true, false], [false, true]];
            const encodedGrid = encodeGrid(grid);
            const hash = `120|4/4|${encodedGrid}|v1`;
            
            const parsed = parseShareHash(hash, rows);
            expect(parsed).not.toBeNull();
            expect(parsed.kitId).toBe('black-pearl'); // default kit
            expect(parsed.grid).toEqual(grid);
            });
    });

    describe('parseInitialHash', () => {
        const SIGNATURES = [
            { name: '4/4', stepsPerBeat: 4 },
            { name: '3/4', stepsPerBeat: 4 },
            { name: '5/4', stepsPerBeat: 4 },
        ];

        it('returns the initial state for a valid hash with a known signature', () => {
            const rows = 3;
            const cols = 16;
            const grid = Array.from({ length: rows }, () => Array.from({ length: cols }, () => false));
            grid[0][0] = true;
            const hash = buildShareHash({ bpm: 128, sigName: '4/4', kitId: 'black-pearl', grid });

            const result = parseInitialHash(hash, rows, SIGNATURES);
            expect(result).not.toBeNull();
            expect(result.success).toBe(true);
            expect(result.bpm).toBe(128);
            expect(result.sig).toBe(SIGNATURES[0]);
            expect(result.kitId).toBe('black-pearl');
            expect(result.grid).toEqual(grid);
        });

        it('round-trips a non-default kit (red-zeppelin) so a shared link restores it', () => {
            const grid = [[true, false], [false, true]];
            const hash = buildShareHash({ bpm: 120, sigName: '4/4', kitId: 'red-zeppelin', grid });
            const result = parseInitialHash(hash, 2, SIGNATURES);
            expect(result).not.toBeNull();
            expect(result.kitId).toBe('red-zeppelin');
        });

        it('returns null when the signature name is unknown', () => {
            const grid = [[true, false], [false, true]];
            const hash = buildShareHash({ bpm: 120, sigName: '7/8', kitId: 'black-pearl', grid });
            expect(parseInitialHash(hash, 2, SIGNATURES)).toBeNull();
        });

        it('returns null when the grid data is corrupt', () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            expect(parseInitialHash('120|4/4|black-pearl|4.!!!bad', 2, SIGNATURES)).toBeNull();
            consoleSpy.mockRestore();
        });

        it('returns null for a hash with too few parts', () => {
            expect(parseInitialHash('120|4/4', 2, SIGNATURES)).toBeNull();
        });

        it('returns null for an empty hash', () => {
            expect(parseInitialHash('', 2, SIGNATURES)).toBeNull();
        });

        // App.jsx:66 calls this at module scope — outside React, outside
        // ErrorBoundary. A throw here is a white screen the user cannot recover
        // from without knowing to edit the URL, so the contract is that any
        // input at all returns null rather than throwing.
        it.each([
            ['a grid segment truncated mid-token', '#120|4/4|black-pearl|4invalid'],
            ['a grid segment that is only a number', '#120|4/4|black-pearl|4'],
            ['an absurd column count', '#120|4/4|black-pearl|2000000.AA'],
            ['a payload shorter than the row count', '#120|4/4|black-pearl|4.AA'],
            ['nothing but separators', '#|||'],
        ])('never throws on %s', (_label, hash) => {
            expect(() => parseInitialHash(hash, 7, SIGNATURES)).not.toThrow();
            expect(parseInitialHash(hash, 7, SIGNATURES)).toBeNull();
        });
    });

    describe('parseShareHash input handling', () => {
        const gridFor = (rows, cols) => Array.from({ length: rows }, () => Array(cols).fill(false));

        it('strips a leading # so window.location.hash can be passed straight in', () => {
            // Every real caller passes window.location.hash, which always carries
            // the '#', and nothing exercised that branch until now.
            const grid = gridFor(2, 4);
            const hash = buildShareHash({ bpm: 120, sigName: '4/4', grid });
            expect(parseShareHash(`#${hash}`, 2)).toEqual(parseShareHash(hash, 2));
        });

        it.each([
            ['below the transport minimum', '1', MIN_BPM],
            ['zero, which would divide by zero in rescaleOffsets', '0', MIN_BPM],
            ['above the transport maximum', '9000', MAX_BPM],
            ['inside the range', '128', 128],
        ])('clamps a bpm %s', (_label, raw, expected) => {
            const parsed = parseShareHash(`${raw}|4/4|black-pearl|${encodeGrid(gridFor(2, 4))}|v1`, 2);
            expect(parsed.bpm).toBe(expected);
        });

        it('returns null when the bpm is not a number at all', () => {
            expect(parseShareHash('abc|4/4|black-pearl|4.AA|v1', 2)).toBeNull();
        });
    });
});
