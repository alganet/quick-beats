// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { describe, it, expect } from 'vitest';
import { HUMANIZE_STYLE } from './humanizeStyle';

describe('humanizeStyle', () => {
    it('keeps timing/velocity within 0..1', () => {
        for (const key of ['timing', 'velocity']) {
            expect(HUMANIZE_STYLE[key]).toBeGreaterThanOrEqual(0);
            expect(HUMANIZE_STYLE[key]).toBeLessThanOrEqual(1);
        }
    });
});
