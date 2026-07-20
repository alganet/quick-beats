// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { describe, it, expect } from 'vitest';
import { parseRoute, buildRoute, OVERLAYS } from './routeState';

const BEAT = '120|4/4|black-pearl|16.AAAA|v1';

describe('routeState', () => {
    describe('parseRoute', () => {
        it('treats an empty hash as setup with no overlay', () => {
            expect(parseRoute('')).toEqual({ overlay: 'none', beat: null });
            expect(parseRoute('#')).toEqual({ overlay: 'none', beat: null });
            expect(parseRoute(undefined)).toEqual({ overlay: 'none', beat: null });
        });

        it('passes a legacy digit-first beat straight through as the beat', () => {
            expect(parseRoute(BEAT)).toEqual({ overlay: 'none', beat: BEAT });
            expect(parseRoute(`#${BEAT}`)).toEqual({ overlay: 'none', beat: BEAT });
        });

        it('parses an overlay-prefixed beat', () => {
            expect(parseRoute(`help~${BEAT}`)).toEqual({ overlay: 'help', beat: BEAT });
            expect(parseRoute(`#share~${BEAT}`)).toEqual({ overlay: 'share', beat: BEAT });
        });

        it('parses a bare overlay with no beat', () => {
            expect(parseRoute('help')).toEqual({ overlay: 'help', beat: null });
            expect(parseRoute('#share')).toEqual({ overlay: 'share', beat: null });
        });

        it('never lets the 4/4 signature slash confuse the ~ split', () => {
            // The beat contains '/'; only the first '~' matters.
            expect(parseRoute(`help~${BEAT}`).beat).toBe(BEAT);
        });

        it('rejects an unknown overlay keyword, degrading to no overlay', () => {
            // A hostile/typo prefix must not open anything; the whole string is
            // treated as a (here invalid) beat rather than a broken UI state.
            expect(parseRoute('foo~bar')).toEqual({ overlay: 'none', beat: 'foo~bar' });
            expect(parseRoute('foo')).toEqual({ overlay: 'none', beat: 'foo' });
        });

        it('handles an overlay prefix with an empty beat tail', () => {
            expect(parseRoute('help~')).toEqual({ overlay: 'help', beat: null });
        });
    });

    describe('buildRoute', () => {
        it('is byte-identical to the beat when there is no overlay (compat anchor)', () => {
            expect(buildRoute({ overlay: 'none', beat: BEAT })).toBe(BEAT);
            expect(buildRoute({ overlay: undefined, beat: BEAT })).toBe(BEAT);
        });

        it('returns an empty string for empty state', () => {
            expect(buildRoute({ overlay: 'none', beat: null })).toBe('');
        });

        it('prefixes the overlay when a beat is present', () => {
            expect(buildRoute({ overlay: 'help', beat: BEAT })).toBe(`help~${BEAT}`);
            expect(buildRoute({ overlay: 'share', beat: BEAT })).toBe(`share~${BEAT}`);
        });

        it('emits a bare overlay when there is no beat', () => {
            expect(buildRoute({ overlay: 'help', beat: null })).toBe('help');
        });
    });

    describe('round-trip', () => {
        it('parse ∘ build is identity for every grammar shape', () => {
            const states = [
                { overlay: 'none', beat: null },
                { overlay: 'none', beat: BEAT },
                { overlay: 'help', beat: BEAT },
                { overlay: 'share', beat: BEAT },
                { overlay: 'help', beat: null },
            ];
            for (const state of states) {
                const expected = state.beat === null && state.overlay === 'none'
                    ? { overlay: 'none', beat: null }
                    : state;
                expect(parseRoute(buildRoute(state))).toEqual(expected);
            }
        });
    });

    it('exports the overlay allowlist as the extensibility point', () => {
        expect(OVERLAYS).toContain('help');
        expect(OVERLAYS).toContain('share');
    });
});
