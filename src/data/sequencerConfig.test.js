// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { describe, it, expect } from 'vitest';
import { ZOOM_CONFIG, INSTRUMENT_ICONS, DEFAULT_ZOOM, normalizeZoom } from './sequencerConfig';

describe('sequencerConfig', () => {
    describe('ZOOM_CONFIG', () => {
        it('should have configuration for zoom level 0 (Small)', () => {
            const config = ZOOM_CONFIG[0];
            expect(config.cellWidth).toBe(20);
            expect(config.gap).toBe(2);
            expect(config.groupGap).toBe(6);
            expect(config.cellHeight).toBe(28);
            expect(config.cellClass).toBe('w-5');
            expect(config.heightClass).toBe('h-7');
            expect(config.gapClass).toBe('gap-0.5');
            expect(config.groupGapClass).toBe('mr-1.5');
            expect(config.radiusClass).toBe('rounded-sm');
        });

        it('should have configuration for zoom level 1 (Medium)', () => {
            const config = ZOOM_CONFIG[1];
            expect(config.cellWidth).toBe(32);
            expect(config.gap).toBe(4);
            expect(config.groupGap).toBe(12);
            expect(config.cellHeight).toBe(40);
            expect(config.cellClass).toBe('w-8');
            expect(config.heightClass).toBe('h-10');
            expect(config.gapClass).toBe('gap-1');
            expect(config.groupGapClass).toBe('mr-3');
            expect(config.radiusClass).toBe('rounded-md');
        });

        it('should have configuration for zoom level 2 (Large)', () => {
            const config = ZOOM_CONFIG[2];
            expect(config.cellWidth).toBe(40);
            expect(config.gap).toBe(4);
            expect(config.groupGap).toBe(16);
            expect(config.cellHeight).toBe(48);
            expect(config.cellClass).toBe('w-10');
            expect(config.heightClass).toBe('h-12');
            expect(config.gapClass).toBe('gap-1');
            expect(config.groupGapClass).toBe('mr-4');
            expect(config.radiusClass).toBe('rounded-md');
        });

        it('should have increasing cell dimensions with zoom level', () => {
            expect(ZOOM_CONFIG[0].cellWidth).toBeLessThan(ZOOM_CONFIG[1].cellWidth);
            expect(ZOOM_CONFIG[1].cellWidth).toBeLessThan(ZOOM_CONFIG[2].cellWidth);
            expect(ZOOM_CONFIG[0].cellHeight).toBeLessThan(ZOOM_CONFIG[1].cellHeight);
            expect(ZOOM_CONFIG[1].cellHeight).toBeLessThan(ZOOM_CONFIG[2].cellHeight);
        });

        it('should have increasing gaps with zoom level', () => {
            expect(ZOOM_CONFIG[0].groupGap).toBeLessThan(ZOOM_CONFIG[1].groupGap);
            expect(ZOOM_CONFIG[1].groupGap).toBeLessThan(ZOOM_CONFIG[2].groupGap);
        });

        it('should have all required properties for each zoom level', () => {
            [0, 1, 2].forEach(level => {
                const config = ZOOM_CONFIG[level];
                expect(config).toHaveProperty('cellWidth');
                expect(config).toHaveProperty('gap');
                expect(config).toHaveProperty('groupGap');
                expect(config).toHaveProperty('cellHeight');
                expect(config).toHaveProperty('cellClass');
                expect(config).toHaveProperty('heightClass');
                expect(config).toHaveProperty('gapClass');
                expect(config).toHaveProperty('groupGapClass');
                expect(config).toHaveProperty('radiusClass');
            });
        });
    });

    describe('normalizeZoom', () => {
        // Several components index ZOOM_CONFIG raw and read a field straight off
        // the result (InstrumentRow, MeasureControls, Sequencer's add-measure
        // button), so anything that reaches state unrecognised is a blank screen
        // rather than a wrong size. Everything below arrives as a localStorage
        // string, which is the only way a foreign value gets in.
        it('passes through every zoom this build renders', () => {
            expect(normalizeZoom('0')).toBe(0);
            expect(normalizeZoom('1')).toBe(1);
            expect(normalizeZoom('2')).toBe(2);
        });

        it('accepts numbers as well as stored strings', () => {
            expect(normalizeZoom(0)).toBe(0);
            expect(normalizeZoom(2)).toBe(2);
        });

        it('falls back for a level this build no longer has', () => {
            // A visitor who used a build with more zoom levels still has its
            // value in localStorage.
            expect(normalizeZoom('3')).toBe(DEFAULT_ZOOM);
            expect(normalizeZoom('-1')).toBe(DEFAULT_ZOOM);
        });

        it('falls back for a value that is not a zoom at all', () => {
            expect(normalizeZoom(null)).toBe(DEFAULT_ZOOM);
            expect(normalizeZoom('')).toBe(DEFAULT_ZOOM);
            expect(normalizeZoom('banana')).toBe(DEFAULT_ZOOM);
            expect(normalizeZoom(undefined)).toBe(DEFAULT_ZOOM);
        });

        it('never returns a level with no config behind it', () => {
            ['0', '1', '2', '3', 'banana', null, ''].forEach((stored) => {
                expect(ZOOM_CONFIG[normalizeZoom(stored)]).toBeDefined();
            });
        });
    });

    describe('INSTRUMENT_ICONS', () => {
        it('should have mapping for Kick', () => {
            expect(INSTRUMENT_ICONS['Kick']).toBe('kick');
        });

        it('should have mapping for Snare', () => {
            expect(INSTRUMENT_ICONS['Snare']).toBe('snare');
        });

        it('should have mapping for Hi-Hat Closed', () => {
            expect(INSTRUMENT_ICONS['Hi-Hat Closed']).toBe('hihat-closed');
        });

        it('should have mapping for Hi-Hat Open', () => {
            expect(INSTRUMENT_ICONS['Hi-Hat Open']).toBe('hihat-open');
        });

        it('should have mapping for Tom', () => {
            expect(INSTRUMENT_ICONS['Tom']).toBe('tom');
        });

        it('should have mapping for Crash', () => {
            expect(INSTRUMENT_ICONS['Crash']).toBe('crash');
        });

        it('should have mapping for Ride', () => {
            expect(INSTRUMENT_ICONS['Ride']).toBe('ride');
        });

        it('should have exactly 7 instrument mappings', () => {
            expect(Object.keys(INSTRUMENT_ICONS)).toHaveLength(7);
        });

        it('should have string values for all icons', () => {
            Object.values(INSTRUMENT_ICONS).forEach(icon => {
                expect(typeof icon).toBe('string');
            });
        });
    });
});
