// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PlayheadOverlay } from './PlayheadOverlay';

// Mock config
vi.mock('../data/sequencerConfig', () => ({
    ZOOM_CONFIG: {
        1: { cellHeight: 32, gapClass: 'gap-1', cellClass: 'w-8', groupGapClass: 'mr-2', cellWidth: 32, gap: 0, groupGap: 8 }
    }
}));

describe('PlayheadOverlay', () => {
    const defaultProps = {
        stepCount: 16,
        currentStep: 4,
        grouping: 4,
        zoom: 1,
        measureCount: 1
    };

    it('renders a single playhead indicator', () => {
        const { container } = render(<PlayheadOverlay {...defaultProps} />);
        const cursor = container.querySelector('[data-testid="playhead-indicator"]');
        expect(cursor).toBeInTheDocument();
    });

    it('positions playhead at current step', () => {
        const { container } = render(<PlayheadOverlay {...defaultProps} />);
        const cursor = container.querySelector('[data-testid="playhead-indicator"]');
        expect(cursor).toBeInTheDocument();
        expect(cursor.style.transform).toBe('translateX(136px)');
    });
});
