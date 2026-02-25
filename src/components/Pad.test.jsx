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
        expect(pad).toHaveClass('bg-[#222]');
        expect(pad).not.toHaveClass('bg-[#3b82f6]');
    });

    it('renders active state correctly', () => {
        render(<Pad {...defaultProps} isActive={true} />);
        const pad = screen.getByTestId('pad');
        expect(pad).toHaveClass('bg-[#3b82f6]');
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
            col: 0
        }));
    });

    it('prevents vertical page scroll on touch (touch-action pan-x)', () => {
        render(<Pad {...defaultProps} />);
        const pad = screen.getByTestId('pad');
        expect(pad).toHaveClass('touch-pan-x');
    });

    it('applies faded styles when faded prop is true', () => {
        render(<Pad {...defaultProps} faded={true} />);
        const pad = screen.getByTestId('pad');
        expect(pad).toHaveClass('opacity-30');
        expect(pad).toHaveClass('pointer-events-none');
    });

    it('does not apply faded styles when faded prop is false', () => {
        render(<Pad {...defaultProps} faded={false} />);
        const pad = screen.getByTestId('pad');
        expect(pad).not.toHaveClass('opacity-30');
        expect(pad).not.toHaveClass('pointer-events-none');
    });

    it('applies group gap margin on last item in group', () => {
        render(<Pad {...defaultProps} colIdx={3} grouping={4} />);
        const pad = screen.getByTestId('pad');
        expect(pad.style.marginRight).toBe('8px');
    });

    it('does not apply group gap margin on non-last item in group', () => {
        render(<Pad {...defaultProps} colIdx={2} grouping={4} />);
        const pad = screen.getByTestId('pad');
        expect(pad.style.marginRight).toBe('');
    });
});
