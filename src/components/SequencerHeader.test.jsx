// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SequencerHeader } from './SequencerHeader';

// Mock config
vi.mock('../data/sequencerConfig', () => ({
    ZOOM_CONFIG: {
        1: { cellClass: 'w-8', gapClass: 'gap-1', groupGapClass: 'mr-2', radiusClass: 'rounded' }
    }
}));

describe('SequencerHeader', () => {
    const defaultProps = {
        stepCount: 16,
        stepsPerMeasure: 4,
        grouping: 4,
        currentStep: 4,
        pendingDelete: null,
        zoom: 1,
        onSeek: vi.fn()
    };

    const getHeaderAndSteps = (container) => {
        const header = container.querySelector('.cursor-pointer');
        const steps = header ? header.querySelectorAll(':scope > div') : [];
        return { header, steps };
    };

    it('renders correct number of steps', () => {
        const { container } = render(<SequencerHeader {...defaultProps} />);
        const { steps } = getHeaderAndSteps(container);
        expect(steps.length).toBe(16);
    });

    it('highlights current step', () => {
        const { container } = render(<SequencerHeader {...defaultProps} />);
        const { steps } = getHeaderAndSteps(container);
        // Step 4 should be highlighted
        expect(steps[4]).toHaveClass('text-accent');
        expect(steps[3]).toHaveClass('text-fg-dim');
    });

    it('displays measure numbers correctly', () => {
        render(<SequencerHeader {...defaultProps} />);
        expect(screen.getByText('1')).toBeInTheDocument(); // Step 0
        expect(screen.getByText('2')).toBeInTheDocument(); // Step 4
        expect(screen.getByText('3')).toBeInTheDocument(); // Step 8
        expect(screen.getByText('4')).toBeInTheDocument(); // Step 12
        // Intermediate steps should be empty or not numbers?
        // Implementation: {i % grouping === 0 ? (i / grouping) + 1 : ''}
        // So steps 1,2,3... are empty strings.
    });

    it('handles click to seek', () => {
        const { container } = render(<SequencerHeader {...defaultProps} />);
        const { header } = getHeaderAndSteps(container);
        fireEvent.click(header);
        expect(defaultProps.onSeek).toHaveBeenCalled();
    });

    it('fades measure when pending delete', () => {
        const { container } = render(<SequencerHeader {...defaultProps} pendingDelete={0} />);
        const { steps } = getHeaderAndSteps(container);
        // Steps 0-3 should be faded
        expect(steps[0]).toHaveClass('opacity-30');
        // Step 4 (Index 1 measure) should not be faded
        expect(steps[4]).not.toHaveClass('opacity-30');
    });
});
