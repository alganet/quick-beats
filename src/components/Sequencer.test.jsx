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
    MemoizedInstrumentRow: ({ instrument, rowIdx, toggleStep, focusedCol, onFocusCell }) => (
        <div data-testid={`mock-instrument-row`} role="row">
            {instrument}
            <button onClick={() => toggleStep(rowIdx, 0)}>Toggle</button>
            {[0, 1, 2].map((c) => (
                <div
                    key={c}
                    data-testid={`cell-${rowIdx}-${c}`}
                    data-row={rowIdx}
                    data-col={c}
                    role="checkbox"
                    aria-checked={false}
                    aria-label={`${instrument} ${c}`}
                    tabIndex={focusedCol === c ? 0 : -1}
                    onFocus={() => onFocusCell?.(rowIdx, c)}
                />
            ))}
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

const { mockSetMenuState } = vi.hoisted(() => ({ mockSetMenuState: vi.fn() }));
vi.mock('../hooks/useSequencerSelection', () => ({
    useSequencerSelection: () => ({
        menuState: { isOpen: false, source: 'drag' },
        setMenuState: mockSetMenuState,
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

// jsdom doesn't implement scrollTo; the focus-into-view effect may call it.
Element.prototype.scrollTo = Element.prototype.scrollTo || vi.fn();

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
            handleWheel: vi.fn(),
            handleTouchStart: vi.fn(),
            handleTouchMove: vi.fn()
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
            handleWheel: vi.fn(),
            handleTouchStart: vi.fn(),
            handleTouchMove: vi.fn()
        });

        // rerender to pick up new hook return value
        rerender(<Sequencer {...defaultProps} autoScroll={false} />);

        // the arrow-right icon should now be present in the DOM
        const offRightIcon = container.querySelector('use[href="#icon-arrow-right"]');
        expect(offRightIcon).toBeInTheDocument();
    });

    it('exposes the grid with roles and one roving tab stop at (0,0)', () => {
        render(<Sequencer {...defaultProps} />);
        expect(screen.getByRole('grid')).toBeInTheDocument();
        expect(screen.getByTestId('cell-0-0')).toHaveAttribute('tabindex', '0');
        expect(screen.getByTestId('cell-0-1')).toHaveAttribute('tabindex', '-1');
        expect(screen.getByTestId('cell-1-0')).toHaveAttribute('tabindex', '-1');
    });

    it('moves the roving tab stop with arrow keys', () => {
        render(<Sequencer {...defaultProps} />);
        fireEvent.keyDown(screen.getByTestId('cell-0-0'), { key: 'ArrowRight' });
        expect(screen.getByTestId('cell-0-1')).toHaveAttribute('tabindex', '0');
        expect(screen.getByTestId('cell-0-0')).toHaveAttribute('tabindex', '-1');

        fireEvent.keyDown(screen.getByTestId('cell-0-1'), { key: 'ArrowDown' });
        expect(screen.getByTestId('cell-1-1')).toHaveAttribute('tabindex', '0');
    });

    it('toggles the focused step on Enter without bubbling to global shortcuts', () => {
        const windowKeySpy = vi.fn();
        window.addEventListener('keydown', windowKeySpy);
        try {
            render(<Sequencer {...defaultProps} />);
            fireEvent.keyDown(screen.getByTestId('cell-0-0'), { key: 'Enter' });
            expect(defaultProps.toggleStep).toHaveBeenCalledWith(0, 0);
            expect(windowKeySpy).not.toHaveBeenCalled(); // consumed, never reaches App
        } finally {
            window.removeEventListener('keydown', windowKeySpy);
        }
    });

    it('toggles the focused pad on Space and consumes the key (ARIA checkbox default)', () => {
        const windowKeySpy = vi.fn();
        window.addEventListener('keydown', windowKeySpy);
        try {
            render(<Sequencer {...defaultProps} />);
            fireEvent.focus(screen.getByTestId('cell-0-0'));
            windowKeySpy.mockClear();
            fireEvent.keyDown(screen.getByTestId('cell-0-0'), { key: ' ' });
            expect(defaultProps.toggleStep).toHaveBeenCalledWith(0, 0);
            // Consumed (preventDefault + stopPropagation) so the page doesn't scroll.
            expect(windowKeySpy).not.toHaveBeenCalled();
        } finally {
            window.removeEventListener('keydown', windowKeySpy);
        }
    });

    it('opens the bulk-fill menu from the keyboard (ContextMenu / Shift+F10 / m)', () => {
        render(<Sequencer {...defaultProps} />);
        fireEvent.keyDown(screen.getByTestId('cell-0-0'), { key: 'ContextMenu' });
        expect(mockSetMenuState).toHaveBeenCalledWith(expect.objectContaining({
            isOpen: true, source: 'menu', row: 0, col: 0, activeOption: 'repeat'
        }));

        mockSetMenuState.mockClear();
        fireEvent.keyDown(screen.getByTestId('cell-0-0'), { key: 'F10', shiftKey: true });
        expect(mockSetMenuState).toHaveBeenCalledWith(expect.objectContaining({ isOpen: true, source: 'menu' }));

        mockSetMenuState.mockClear();
        fireEvent.keyDown(screen.getByTestId('cell-0-0'), { key: 'm' });
        expect(mockSetMenuState).toHaveBeenCalledWith(expect.objectContaining({ isOpen: true, source: 'menu' }));
    });

    it('leaves browser/OS chords alone (modified keys are not grid shortcuts)', () => {
        render(<Sequencer {...defaultProps} />);
        fireEvent.keyDown(screen.getByTestId('cell-0-0'), { key: 'm', ctrlKey: true });
        fireEvent.keyDown(screen.getByTestId('cell-0-0'), { key: 'm', altKey: true });
        expect(mockSetMenuState).not.toHaveBeenCalled();
        fireEvent.keyDown(screen.getByTestId('cell-0-0'), { key: ' ', ctrlKey: true });
        expect(defaultProps.toggleStep).not.toHaveBeenCalled();
    });

    it('does not toggle a step in a measure pending deletion (faded)', () => {
        render(<Sequencer {...defaultProps} />);
        fireEvent.click(screen.getByText('Delete 0')); // setPendingDelete(0) -> measure 0 faded
        fireEvent.keyDown(screen.getByTestId('cell-0-0'), { key: ' ' });
        expect(defaultProps.toggleStep).not.toHaveBeenCalled();
        // ...but the menu also stays closed for a faded cell
        fireEvent.keyDown(screen.getByTestId('cell-0-0'), { key: 'ContextMenu' });
        expect(mockSetMenuState).not.toHaveBeenCalled();
    });

    it('routes scroll gestures to the hook, which decides on their axis', () => {
        const wheelSpy = vi.fn();
        const touchStartSpy = vi.fn();
        const touchMoveSpy = vi.fn();
        mockUseAutoScroll.mockReturnValue({
            playheadOffRight: false,
            playheadOffLeft: false,
            handleWheel: wheelSpy,
            handleTouchStart: touchStartSpy,
            handleTouchMove: touchMoveSpy
        });

        render(<Sequencer {...defaultProps} />);
        const scrollContainer = document.querySelector('[data-sequencer-scroll-container="true"]');
        expect(scrollContainer).not.toBeNull();

        fireEvent.wheel(scrollContainer);
        expect(wheelSpy).toHaveBeenCalled();

        // touchStart must be wired too, or touchMove has no origin to compare against
        fireEvent.touchStart(scrollContainer, { touches: [{ clientX: 0, clientY: 0 }] });
        fireEvent.touchMove(scrollContainer, { touches: [{ clientX: 10, clientY: 0 }] });
        expect(touchStartSpy).toHaveBeenCalled();
        expect(touchMoveSpy).toHaveBeenCalled();
    });
});

