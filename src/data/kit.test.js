// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { describe, it, expect } from 'vitest';
import { KITS, KIT, INSTRUMENTS, DEFAULT_KIT_ID } from './kit';

describe('kit data', () => {
    describe('KITS', () => {
        it('should have at least one kit defined', () => {
            expect(Object.keys(KITS).length).toBeGreaterThan(0);
        });

        it('should have a "black-pearl" kit', () => {
            expect(KITS['black-pearl']).toBeDefined();
        });

        it('each kit should have a name and samples', () => {
            Object.entries(KITS).forEach(([_id, kit]) => {
                expect(kit.name).toBeDefined();
                expect(typeof kit.name).toBe('string');
                expect(kit.samples).toBeDefined();
                expect(typeof kit.samples).toBe('object');
            });
        });

        it('each kit sample should point to a valid file path', () => {
            Object.entries(KITS).forEach(([_id, kit]) => {
                Object.values(kit.samples).forEach(path => {
                    expect(path).toMatch(/\.(wav|mp3|ogg)$/);
                });
            });
        });
    });

    describe('KIT (backward compatibility)', () => {
        it('should export samples from black-pearl kit', () => {
            expect(KIT).toEqual(KITS['black-pearl'].samples);
        });
    });

    describe('INSTRUMENTS', () => {
        it('should be an array of instrument names', () => {
            expect(Array.isArray(INSTRUMENTS)).toBe(true);
            expect(INSTRUMENTS.length).toBeGreaterThan(0);
        });

        it('should contain expected instruments', () => {
            expect(INSTRUMENTS).toContain('Kick');
            expect(INSTRUMENTS).toContain('Snare');
            expect(INSTRUMENTS).toContain('Hi-Hat Closed');
        });

        it('should have 7 instruments total', () => {
            expect(INSTRUMENTS).toHaveLength(7);
        });
    });

    describe('DEFAULT_KIT_ID', () => {
        it('should be "black-pearl"', () => {
            expect(DEFAULT_KIT_ID).toBe('black-pearl');
        });

        it('should reference an existing kit', () => {
            expect(KITS[DEFAULT_KIT_ID]).toBeDefined();
        });
    });
});
