// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import ProgressRing from './ProgressRing';

const CIRC = 2 * Math.PI * 15;

// The arc is the second circle; the first is the unfilled track.
const arcDash = (container) => container.querySelectorAll('circle')[1].getAttribute('stroke-dasharray');

describe('ProgressRing', () => {
    it('fills the arc in proportion to progress', () => {
        const { container } = render(<ProgressRing progress={0.5} />);
        expect(arcDash(container)).toBe(`${0.5 * CIRC} ${CIRC}`);
    });

    it('draws no arc at zero and a full one at one', () => {
        const { container: empty } = render(<ProgressRing progress={0} />);
        expect(arcDash(empty)).toBe(`0 ${CIRC}`);

        const { container: full } = render(<ProgressRing progress={1} />);
        expect(arcDash(full)).toBe(`${CIRC} ${CIRC}`);
    });

    it.each([
        ['below zero', -1, 0],
        ['above one', 2, CIRC],
    ])('clamps progress %s', (_label, progress, expected) => {
        // Callers divide loaded-by-total, so a stale total or an extra response
        // can hand this a value outside 0..1.
        const { container } = render(<ProgressRing progress={progress} />);
        expect(arcDash(container)).toBe(`${expected} ${CIRC}`);
    });

    it.each([
        ['NaN', NaN],
        ['undefined', undefined],
    ])('renders a valid dash array for %s rather than emitting NaN', (_label, progress) => {
        // Math.max/Math.min pass NaN straight through, so an unguarded value
        // reaches the DOM as stroke-dasharray="NaN 94.2" — invalid SVG, and the
        // ring silently disappears instead of showing an empty state.
        const { container } = render(<ProgressRing progress={progress} />);
        expect(arcDash(container)).toBe(`0 ${CIRC}`);
    });

    it('renders its children inside the ring', () => {
        render(<ProgressRing progress={0.3}><span>icon</span></ProgressRing>);
        expect(screen.getByText('icon')).toBeInTheDocument();
    });
});
