// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Pad from './Pad';

describe('Pad', () => {
    const defaultProps = {
        isActive: false,
        rowIdx: 0,
        colIdx: 0,
        grouping: 4,
        stepsPerMeasure: 16,
        config: {
            cellClass: 'w-10',
            radiusClass: 'rounded-md',
            groupGapClass: 'mr-4',
            groupGap: 8,
            cellHeight: 48,
            gap: 4
        },
        toggleStep: vi.fn(),
        setMenuState: vi.fn(),
        faded: false
    };

    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    it('renders inactive state correctly', () => {
        render(<Pad {...defaultProps} />);
        const pad = screen.getByTestId('pad');
        expect(pad).toHaveClass('bg-surface-5');
        expect(pad).not.toHaveClass('bg-primary');
    });

    it('outlines the inactive pad so its boundary survives the lane background', () => {
        render(<Pad {...defaultProps} />);
        const pad = screen.getByTestId('pad');
        expect(pad).toHaveClass('border-border-bright');
    });

    it('renders active state correctly', () => {
        render(<Pad {...defaultProps} isActive={true} />);
        const pad = screen.getByTestId('pad');
        expect(pad).toHaveClass('bg-primary');
        expect(pad).not.toHaveClass('border-border-bright');
    });

    it('renders the accent hue for a humanized active pad', () => {
        render(<Pad {...defaultProps} isActive={true} humanized={true} />);
        const pad = screen.getByTestId('pad');
        expect(pad).toHaveClass('bg-accent');
        expect(pad).not.toHaveClass('bg-primary'); // distinct hue, not the base tone
    });

    it('marks a humanized active pad with a non-colour corner glyph', () => {
        const { container } = render(<Pad {...defaultProps} isActive={true} humanized={true} />);
        const mark = container.querySelector('.text-accent-mark');
        expect(mark).toBeInTheDocument();
        expect(mark).toHaveAttribute('aria-hidden', 'true');
    });

    it('shows no corner glyph on a plain active pad', () => {
        const { container } = render(<Pad {...defaultProps} isActive={true} humanized={false} />);
        expect(container.querySelector('.text-accent-mark')).toBeNull();
    });

    it('shows no corner glyph on an inactive humanized pad', () => {
        const { container } = render(<Pad {...defaultProps} isActive={false} humanized={true} />);
        expect(container.querySelector('.text-accent-mark')).toBeNull();
    });

    it('keeps the base tone for an active pad the model did not shape', () => {
        render(<Pad {...defaultProps} isActive={true} humanized={false} />);
        const pad = screen.getByTestId('pad');
        expect(pad).toHaveClass('bg-primary');
        expect(pad).not.toHaveClass('bg-accent');
    });

    it('ignores humanized when inactive (no hit, no tint)', () => {
        render(<Pad {...defaultProps} isActive={false} humanized={true} />);
        const pad = screen.getByTestId('pad');
        expect(pad).toHaveClass('bg-surface-5');
        expect(pad).not.toHaveClass('bg-accent');
    });

    it('calls toggleStep on click', () => {
        render(<Pad {...defaultProps} />);
        const pad = screen.getByTestId('pad');
        
        fireEvent.mouseDown(pad);
        // Short press
        act(() => {
            vi.advanceTimersByTime(100);
        });
        fireEvent.mouseUp(pad);

        expect(defaultProps.toggleStep).toHaveBeenCalledWith(0, 0);
    });

    it('toggles on a synthesized click (screen-reader activation, detail 0)', () => {
        defaultProps.toggleStep.mockClear();
        render(<Pad {...defaultProps} />);
        const pad = screen.getByTestId('pad');

        // VoiceOver/NVDA browse mode activate a checkbox with a click that has
        // no preceding mousedown/mouseup and detail 0.
        fireEvent.click(pad, { detail: 0 });
        expect(defaultProps.toggleStep).toHaveBeenCalledTimes(1);
        expect(defaultProps.toggleStep).toHaveBeenCalledWith(0, 0);
    });

    it('ignores pointer-originated clicks (detail ≥ 1) so the press path cannot double-fire', () => {
        defaultProps.toggleStep.mockClear();
        render(<Pad {...defaultProps} />);
        const pad = screen.getByTestId('pad');

        fireEvent.click(pad, { detail: 1 });
        expect(defaultProps.toggleStep).not.toHaveBeenCalled();
    });

    it('opens menu on long press', () => {
        render(<Pad {...defaultProps} />);
        const pad = screen.getByTestId('pad');
        
        // Mock getBoundingClientRect
        // Note: internal ref might not expose the element directly easily for mocking its method if we rely on refs internal to component.
        // Wait, padRef is internal. `padRef.current.getBoundingClientRect()` is called.
        // How to mock `getBoundingClientRect` of an element rendered by the component?
        // JSdom elements have this method but it returns zeros.
        // We can spy on HTMLElement.prototype.getBoundingClientRect?
        
        vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
            left: 100,
            top: 200,
            width: 50,
            height: 50,
            right: 150,
            bottom: 250,
            x: 100,
            y: 200,
            toJSON: () => {}
        });

        fireEvent.mouseDown(pad);
        
        act(() => {
            vi.advanceTimersByTime(500);
        });

        expect(defaultProps.setMenuState).toHaveBeenCalledWith(expect.objectContaining({
            isOpen: true,
            x: 125, // 100 + 50/2
            y: 200,
            row: 0,
            col: 0,
            source: 'pointer'
        }));
    });

    it('opens the fill menu on right-click (desktop equivalent of long-press)', () => {
        vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
            left: 10, top: 20, width: 40, height: 40, right: 50, bottom: 60, x: 10, y: 20, toJSON: () => {}
        });
        render(<Pad {...defaultProps} />);
        const pad = screen.getByTestId('pad');

        fireEvent.contextMenu(pad);

        expect(defaultProps.setMenuState).toHaveBeenCalledWith(expect.objectContaining({
            isOpen: true, source: 'pointer', row: 0, col: 0,
        }));
    });

    it('suppresses double-tap-zoom while allowing pan and pinch-zoom on touch', () => {
        render(<Pad {...defaultProps} />);
        const pad = screen.getByTestId('pad');
        expect(pad).toHaveClass('[touch-action:pan-x_pinch-zoom]');
    });

    it('exposes no fill-menu disclosure when the menu is closed', () => {
        render(<Pad {...defaultProps} />);
        const pad = screen.getByTestId('pad');
        expect(pad).not.toHaveAttribute('aria-haspopup');
        expect(pad).not.toHaveAttribute('aria-expanded');
    });

    it('exposes the trigger disclosure while its menu is open', () => {
        // Virtual focus + the active option live on the menu itself; the pad is
        // just the trigger, so it advertises only the open popup.
        render(<Pad {...defaultProps} menuOpen />);
        const pad = screen.getByTestId('pad');
        expect(pad).toHaveAttribute('aria-haspopup', 'menu');
        expect(pad).toHaveAttribute('aria-expanded', 'true');
        expect(pad).not.toHaveAttribute('aria-activedescendant');
        expect(pad).not.toHaveAttribute('aria-owns');
    });

    it('applies faded styles to the cell when faded prop is true', () => {
        render(<Pad {...defaultProps} faded={true} />);
        const cell = screen.getByTestId('pad').parentElement;
        expect(cell).toHaveClass('opacity-30');
        expect(cell).toHaveClass('pointer-events-none');
    });

    it('does not apply faded styles when faded prop is false', () => {
        render(<Pad {...defaultProps} faded={false} />);
        const cell = screen.getByTestId('pad').parentElement;
        expect(cell).not.toHaveClass('opacity-30');
        expect(cell).not.toHaveClass('pointer-events-none');
    });

    it('applies group gap margin on last item in group', () => {
        render(<Pad {...defaultProps} colIdx={3} grouping={4} />);
        const cell = screen.getByTestId('pad').parentElement;
        expect(cell.style.marginRight).toBe('8px');
    });

    it('does not apply group gap margin on non-last item in group', () => {
        render(<Pad {...defaultProps} colIdx={2} grouping={4} />);
        const cell = screen.getByTestId('pad').parentElement;
        expect(cell.style.marginRight).toBe('');
    });

    it('exposes checkbox semantics reflecting active state', () => {
        const { rerender } = render(<Pad {...defaultProps} isActive={false} />);
        const pad = screen.getByTestId('pad');
        expect(pad).toHaveAttribute('role', 'checkbox');
        expect(pad).toHaveAttribute('aria-checked', 'false');
        rerender(<Pad {...defaultProps} isActive={true} />);
        expect(screen.getByTestId('pad')).toHaveAttribute('aria-checked', 'true');
    });

    it('labels the pad with instrument and 1-based step, and marks humanized', () => {
        render(<Pad {...defaultProps} instrument="Snare" colIdx={4} isActive humanized />);
        const pad = screen.getByTestId('pad');
        expect(pad).toHaveAttribute('aria-label', 'Snare, step 5, humanized');
        expect(pad).toHaveAttribute('data-row', '0');
        expect(pad).toHaveAttribute('data-col', '4');
    });

    it('wraps the pad in a gridcell whose colindex offsets past the rowheader', () => {
        render(<Pad {...defaultProps} colIdx={4} />);
        const cell = screen.getByTestId('pad').parentElement;
        expect(cell).toHaveAttribute('role', 'gridcell');
        // colindex 1 is the row's sticky rowheader, so pad colIdx 4 is column 6.
        expect(cell).toHaveAttribute('aria-colindex', '6');
    });
});
