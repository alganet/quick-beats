// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Sequencer from './Sequencer';
import { INSTRUMENTS } from '../data/kit';
// import the hook here so we can access the mocked function later
import { useAutoScroll } from '../hooks/useAutoScroll';

// alias the imported function for clarity in tests
const mockUseAutoScroll = useAutoScroll;

// Mocks
vi.mock('./SequencerHeader', () => ({
    SequencerHeader: ({ onSeek, currentStep }) => (
        <div data-testid="mock-header" onClick={(e) => onSeek(e)}>
            Header: {currentStep}
        </div>
    )
}));

vi.mock('./InstrumentRow', () => ({
    MemoizedInstrumentRow: ({ instrument, rowIdx, toggleStep }) => (
        <div data-testid={`mock-instrument-row`}>
            {instrument}
            <button onClick={() => toggleStep(rowIdx, 0)}>Toggle</button>
        </div>
    )
}));

vi.mock('./MeasureControls', () => ({
    MeasureControls: ({ setPendingDelete }) => (
        <div data-testid="mock-measure-controls">
            <button onClick={() => setPendingDelete(0)}>Delete 0</button>
        </div>
    )
}));

vi.mock('./PlayheadOverlay', () => ({
    PlayheadOverlay: () => <div data-testid="mock-playhead" />
}));

vi.mock('./ContextMenu', () => ({
    default: ({ isOpen }) => isOpen ? <div data-testid="mock-context-menu">Menu</div> : null
}));

// mock the hook; we'll grab the mocked function via import below
vi.mock('../hooks/useAutoScroll', () => ({
    useAutoScroll: vi.fn()
}));

vi.mock('../hooks/useSequencerSelection', () => ({
    useSequencerSelection: () => ({
        menuState: { isOpen: false },
        setMenuState: vi.fn(),
        menuRef: { current: null }
    })
}));

vi.mock('../data/sequencerConfig', () => ({
    ZOOM_CONFIG: {
        1: { cellWidth: 32, gap: 4, groupGap: 8 }
    }
}));

// ResizeObserver mock is needed for Sequencer
global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
};

// Mock getBoundingClientRect
Element.prototype.getBoundingClientRect = vi.fn(() => ({
    left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600
}));

describe('Sequencer', () => {
    const defaultProps = {
        isPlaying: false,
        togglePlay: vi.fn(),
        grid: INSTRUMENTS.map(() => Array(16).fill(false)),
        toggleStep: vi.fn(),
        bulkUpdateStep: vi.fn(),
        currentStep: 0,
        stepCount: 16,
        setStep: vi.fn(),
        addMeasure: vi.fn(),
        removeMeasure: vi.fn(),
        beatsPerMeasure: 4,
        stepsPerBeat: 4,
        grouping: 4,
        autoScroll: true,
        setAutoScroll: vi.fn(),
        setCanScroll: vi.fn(),
        zoom: 1
    };

    beforeEach(() => {
        vi.clearAllMocks();
        // make sure useAutoScroll always returns a valid object by default
        mockUseAutoScroll.mockReturnValue({
            playheadOffRight: false,
            playheadOffLeft: false,
            handleManualScroll: vi.fn()
        });
    });

    it('renders all instrument rows', () => {
        render(<Sequencer {...defaultProps} />);
        const rows = screen.getAllByTestId('mock-instrument-row');
        expect(rows.length).toBe(INSTRUMENTS.length);
        expect(rows[0]).toHaveTextContent('Kick');
    });

    it('renders header, playhead and measure controls', () => {
        render(<Sequencer {...defaultProps} />);
        expect(screen.getByTestId('mock-header')).toBeInTheDocument();
        expect(screen.getByTestId('mock-playhead')).toBeInTheDocument();
        expect(screen.getByTestId('mock-measure-controls')).toBeInTheDocument();
    });

    it('handles seek functionality and stops playback when playing', () => {
        // When playing, seeking should setStep and togglePlay (to stop)
        render(<Sequencer {...defaultProps} isPlaying={true} />);
        const header = screen.getByTestId('mock-header');

        fireEvent.click(header, { clientX: 100 });
        expect(defaultProps.setStep).toHaveBeenCalled();
        expect(defaultProps.togglePlay).toHaveBeenCalled();
    });

    it('handles seek functionality when not playing', () => {
        render(<Sequencer {...defaultProps} isPlaying={false} />);
        const header = screen.getByTestId('mock-header');

        fireEvent.click(header, { clientX: 100 });
        expect(defaultProps.setStep).toHaveBeenCalled();
        expect(defaultProps.togglePlay).not.toHaveBeenCalled();
    });

    it('passes toggleStep to instrument rows', () => {
        render(<Sequencer {...defaultProps} />);
        const btns = screen.getAllByText('Toggle');
        fireEvent.click(btns[0]);
        expect(defaultProps.toggleStep).toHaveBeenCalledWith(0, 0);
    });

    it('handles pending delete interaction', () => {
        // Just verify it doesn't crash when setPendingDelete is called
        render(<Sequencer {...defaultProps} />);
        fireEvent.click(screen.getByText('Delete 0'));
        // Props to InstrumentRow would change (pendingDelete would not be null)
        // But we are mocking InstrumentRow, so we can't easily check props unless we spy on component?
        // We can check if it calls removeMeasure if we confirm?
        // But MeasureControls handles the confirm internal logic (tested separately).
        // This test confirms the wiring exists.
    });

    it('calls addMeasure when add measure button is clicked', () => {
        render(<Sequencer {...defaultProps} />);
        const addButton = screen.getByTitle('Add Measure');
        fireEvent.click(addButton);
        expect(defaultProps.addMeasure).toHaveBeenCalled();
    });

    it('shows playhead off right indicator when playheadOffRight is true and autoScroll is false', () => {
        // start with default autoScroll=false
        const { rerender, container } = render(<Sequencer {...defaultProps} autoScroll={false} />);

        // override the mock return value for this scenario
        mockUseAutoScroll.mockReturnValue({
            playheadOffRight: true,
            playheadOffLeft: false,
            handleManualScroll: vi.fn()
        });

        // rerender to pick up new hook return value
        rerender(<Sequencer {...defaultProps} autoScroll={false} />);

        // the arrow-right icon should now be present in the DOM
        const offRightIcon = container.querySelector('use[href="#icon-arrow-right"]');
        expect(offRightIcon).toBeInTheDocument();
    });

    it('handles wheel event for manual scroll', () => {
        // prepare a spy for handleManualScroll
        const manualScrollSpy = vi.fn();
        mockUseAutoScroll.mockReturnValue({
            playheadOffRight: false,
            playheadOffLeft: false,
            handleManualScroll: manualScrollSpy
        });

        render(<Sequencer {...defaultProps} />);
        const scrollContainer = document.querySelector('[data-sequencer-scroll-container="true"]');
        expect(scrollContainer).not.toBeNull();

        fireEvent.wheel(scrollContainer);
        expect(manualScrollSpy).toHaveBeenCalled();
    });
});

