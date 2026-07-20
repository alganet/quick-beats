// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Sequencer from './Sequencer';
import { INSTRUMENTS } from '../data/kit';
import { stepToX, getGridOriginOffsetPx } from '../utils/sequencerGeometry';
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

// Mirrors the real three zoom levels rather than a single invented one, so the
// seek tests below can assert the coordinate mapping at more than one cell size.
vi.mock('../data/sequencerConfig', () => ({
    ZOOM_CONFIG: {
        0: { cellWidth: 20, gap: 2, groupGap: 6 },
        1: { cellWidth: 32, gap: 4, groupGap: 12 },
        2: { cellWidth: 40, gap: 4, groupGap: 16 }
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

    describe('seeking from a click', () => {
        // The x the user clicks is offset by the instrument-label gutter before
        // it becomes a step. Deriving the click position from the real geometry
        // helpers — rather than hardcoding pixels — means these assert the
        // wiring (gutter subtracted, stepCount/grouping/zoom passed through)
        // without restating the layout constants a second time.
        const clientXForStep = (step, zoom) =>
            getGridOriginOffsetPx(false) + stepToX(step, defaultProps.grouping, zoom) + 2;

        it.each([
            ['the first step', 0],
            ['a step inside the first group', 2],
            ['the step just past a group gap', 4],
            ['a step several groups in', 11],
        ])('maps a click on %s to that step', (_label, step) => {
            render(<Sequencer {...defaultProps} zoom={1} />);

            fireEvent.click(screen.getByTestId('mock-header'), { clientX: clientXForStep(step, 1) });

            expect(defaultProps.setStep).toHaveBeenCalledWith(step);
        });

        it('maps the same click to a different step at a different zoom', () => {
            // Guards against the zoom prop being dropped on the way to xToStep:
            // at zoom 0 the cells are narrower, so one x lands further along.
            render(<Sequencer {...defaultProps} zoom={0} />);

            fireEvent.click(screen.getByTestId('mock-header'), { clientX: clientXForStep(7, 0) });

            expect(defaultProps.setStep).toHaveBeenCalledWith(7);
        });

        it('clamps a click left of the grid to the first step', () => {
            render(<Sequencer {...defaultProps} />);

            fireEvent.click(screen.getByTestId('mock-header'), { clientX: 0 });

            expect(defaultProps.setStep).toHaveBeenCalledWith(0);
        });

        it('clamps a click past the end to the last step', () => {
            render(<Sequencer {...defaultProps} />);

            fireEvent.click(screen.getByTestId('mock-header'), { clientX: 100000 });

            expect(defaultProps.setStep).toHaveBeenCalledWith(defaultProps.stepCount - 1);
        });

        it('stops playback when seeking mid-playback', () => {
            render(<Sequencer {...defaultProps} isPlaying={true} />);

            fireEvent.click(screen.getByTestId('mock-header'), { clientX: clientXForStep(3, 1) });

            expect(defaultProps.setStep).toHaveBeenCalledWith(3);
            expect(defaultProps.togglePlay).toHaveBeenCalled();
        });

        it('leaves a stopped transport stopped', () => {
            render(<Sequencer {...defaultProps} isPlaying={false} />);

            fireEvent.click(screen.getByTestId('mock-header'), { clientX: clientXForStep(3, 1) });

            expect(defaultProps.setStep).toHaveBeenCalledWith(3);
            expect(defaultProps.togglePlay).not.toHaveBeenCalled();
        });
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

