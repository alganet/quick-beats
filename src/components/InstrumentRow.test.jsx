// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { InstrumentRow } from './InstrumentRow';

// Mock dependencies
vi.mock('./Pad', () => ({
    default: ({ 
        rowIdx, 
        colIdx, 
        isActive, 
        toggleStep, 
        bulkUpdateStep, 
        setMenuState, 
        isPlaying,
        faded,
        armed,
        ...props 
    }) => (
        <button 
            data-testid={`pad-${colIdx}`} 
            onClick={() => toggleStep && toggleStep(rowIdx, colIdx)}
            onContextMenu={(e) => { e.preventDefault(); setMenuState && setMenuState({ x: 0, y: 0, row: rowIdx, col: colIdx }); }}
            onMouseEnter={() => bulkUpdateStep && bulkUpdateStep(rowIdx, colIdx)}
            className={isActive ? 'active' : ''}
            data-isplaying={isPlaying}
            data-faded={faded}
            data-armed={String(armed)}
            {...props}
        >
            {isActive ? 'Active' : 'Inactive'}
        </button>
    )
}));

vi.mock('./Icons', () => ({
    Icon: ({ id }) => <div data-testid={`icon-${id}`}>Icon: {id}</div>
}));

// Mock config if needed, but it's imported from data/sequencerConfig
// We might need to mock sequencerConfig if it's huge, but it's likely just data.
// Since InstrumentRow imports it directly, `vi.mock` is cleaner if we want control.
vi.mock('../data/sequencerConfig', async () => {
    const actual = await vi.importActual('../data/sequencerConfig');
    return {
        ...actual,
        INSTRUMENT_ICONS: { 'kick': 'kick-icon' },
        ZOOM_CONFIG: {
            1: { heightClass: 'h-12', gapClass: 'gap-1', cellWidth: 32, gap: 4, groupGap: 8 }
        }
    };
});

describe('InstrumentRow', () => {
    const defaultProps = {
        instrument: 'kick',
        rowIdx: 0,
        gridRow: [true, false, true, false], // 4 steps
        currentStep: 0,
        stepsPerMeasure: 4,
        grouping: 4,
        toggleStep: vi.fn(),
        bulkUpdateStep: vi.fn(),
        setMenuState: vi.fn(),
        pendingDelete: false,
        zoom: 1
    };

    it('renders instrument icon', () => {
        render(<InstrumentRow {...defaultProps} />);
        expect(screen.getByTestId('icon-kick-icon')).toBeInTheDocument();
        expect(screen.getByTitle('kick')).toBeInTheDocument();
    });

    it('renders correct number of pads', () => {
        render(<InstrumentRow {...defaultProps} />);
        // gridRow has 4 elements
        expect(screen.getByTestId('pad-0')).toBeInTheDocument();
        expect(screen.getByTestId('pad-3')).toBeInTheDocument();
        expect(screen.queryByTestId('pad-4')).not.toBeInTheDocument();
    });

    it('passes correct active state to pads', () => {
        render(<InstrumentRow {...defaultProps} />);
        expect(screen.getByTestId('pad-0')).toHaveClass('active');
        expect(screen.getByTestId('pad-1')).not.toHaveClass('active');
    });

    it('handles pad click', () => {
        render(<InstrumentRow {...defaultProps} />);
        fireEvent.click(screen.getByTestId('pad-1'));
        expect(defaultProps.toggleStep).toHaveBeenCalledWith(0, 1);
    });

    it('handles pad context menu', () => {
        render(<InstrumentRow {...defaultProps} />);
        fireEvent.contextMenu(screen.getByTestId('pad-1'));
        // setMenuState called with relevant data
        expect(defaultProps.setMenuState).toHaveBeenCalled();
        // Check args? Depends on implementation.
        // Usually: setMenuState({ x, y, type: 'pad', ... })
    });
});
