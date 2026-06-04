// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import LoadingScreen from './LoadingScreen';

describe('LoadingScreen', () => {
    it('renders the brand and a status with the percent', () => {
        render(<LoadingScreen progress={0.5} />);
        expect(screen.getByText('Quick Beats')).toBeInTheDocument();
        expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Loading sounds, 50 percent');
    });

    it('drives the progress bar width from progress', () => {
        const { container } = render(<LoadingScreen progress={0.25} />);
        const bar = container.querySelector('.bg-primary');
        expect(bar).toHaveStyle({ width: '25%' });
    });

    it('clamps out-of-range progress', () => {
        render(<LoadingScreen progress={2} />);
        expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Loading sounds, 100 percent');
    });
});
