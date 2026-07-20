// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MeasureControls } from './MeasureControls';

// Mock ConfirmBar since it's already tested
vi.mock('./ConfirmBar', () => ({
    default: ({ onConfirm, onCancel }) => (
        <div data-testid="confirm-bar">
            <button onClick={onConfirm}>Yes</button>
            <button onClick={onCancel}>No</button>
        </div>
    )
}));

describe('MeasureControls', () => {
    const defaultProps = {
        measureCount: 2,
        stepsPerMeasure: 16,
        grouping: 4,
        pendingDelete: null,
        setPendingDelete: vi.fn(),
        removeMeasure: vi.fn(),
        zoom: 1
    };

    it('renders nothing if measureCount is 1', () => {
        const { container } = render(<MeasureControls {...defaultProps} measureCount={1} />);
        expect(container).toBeEmptyDOMElement();
    });

    it('renders correct number of delete buttons', () => {
        render(<MeasureControls {...defaultProps} measureCount={3} />);
        const buttons = screen.getAllByText('x');
        expect(buttons).toHaveLength(3);
    });

    it('exposes each idle delete strip as a named button', () => {
        render(<MeasureControls {...defaultProps} />);
        expect(screen.getByRole('button', { name: 'Delete measure 1' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Delete measure 2' })).toBeInTheDocument();
    });

    it('sets pending delete on click', () => {
        const setPendingDelete = vi.fn();
        render(<MeasureControls {...defaultProps} setPendingDelete={setPendingDelete} />);
        
        const buttons = screen.getAllByText('x');
        fireEvent.click(buttons[0]);
        
        expect(setPendingDelete).toHaveBeenCalledWith(0);
    });

    it('scrolls horizontally to center selected measure before opening confirm', () => {
        const setPendingDelete = vi.fn();
        const scrollTo = vi.fn();

        const { container } = render(
            <div data-sequencer-scroll-container="true" className="overflow-x-auto">
                <MeasureControls {...defaultProps} setPendingDelete={setPendingDelete} />
            </div>
        );

        const scrollContainer = container.querySelector('[data-sequencer-scroll-container="true"]');
        Object.defineProperty(scrollContainer, 'clientWidth', { value: 300, configurable: true });
        Object.defineProperty(scrollContainer, 'scrollWidth', { value: 1200, configurable: true });
        Object.defineProperty(scrollContainer, 'scrollLeft', { value: 100, configurable: true, writable: true });
        scrollContainer.scrollTo = scrollTo;
        scrollContainer.getBoundingClientRect = vi.fn(() => ({ left: 10, width: 300 }));

        const firstDeleteIcon = screen.getAllByText('x')[0];
        const firstMeasureControl = firstDeleteIcon.closest('[data-measure-control-index="0"]');
        firstMeasureControl.getBoundingClientRect = vi.fn(() => ({ left: 330, width: 60 }));

        fireEvent.click(firstDeleteIcon);

        expect(scrollTo).toHaveBeenCalledWith({ left: 300, behavior: 'smooth' });
        expect(setPendingDelete).toHaveBeenCalledWith(0);
    });

    it('renders ConfirmBar when pending delete matches index', () => {
        render(<MeasureControls {...defaultProps} pendingDelete={1} />);
        
        expect(screen.getByTestId('confirm-bar')).toBeInTheDocument();
        // The second measure (index 1) should show confirm bar, others show minus
        const minusButtons = screen.getAllByText('x');
        expect(minusButtons).toHaveLength(1); // 2 measures total, 1 pending = 1 minus visible
    });

    it('calls removeMeasure when confirmed', () => {
        const removeMeasure = vi.fn();
        const setPendingDelete = vi.fn();
        
        render(
            <MeasureControls 
                {...defaultProps} 
                pendingDelete={0} 
                removeMeasure={removeMeasure} 
                setPendingDelete={setPendingDelete}
            />
        );
        
        fireEvent.click(screen.getByText('Yes'));
        expect(removeMeasure).toHaveBeenCalledWith(0);
        expect(setPendingDelete).toHaveBeenCalledWith(null);
    });

    it('cancels delete when cancelled', () => {
        const removeMeasure = vi.fn();
        const setPendingDelete = vi.fn();
        
        render(
            <MeasureControls 
                {...defaultProps} 
                pendingDelete={0} 
                removeMeasure={removeMeasure} 
                setPendingDelete={setPendingDelete}
            />
        );
        
        fireEvent.click(screen.getByText('No'));
        expect(removeMeasure).not.toHaveBeenCalled();
        expect(setPendingDelete).toHaveBeenCalledWith(null);
    });

    it('returns focus to the delete strip after cancelling', () => {
        // The ConfirmBar's focused button unmounts on resolve, dropping keyboard
        // focus to <body>; the remounted delete strip must pick it back up.
        const { rerender } = render(<MeasureControls {...defaultProps} pendingDelete={1} />);
        screen.getByText('No').focus();
        fireEvent.click(screen.getByText('No'));
        rerender(<MeasureControls {...defaultProps} pendingDelete={null} />);
        expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Delete measure 2' }));
    });

    it('clamps the focus target when the last measure was deleted', () => {
        const { rerender } = render(<MeasureControls {...defaultProps} measureCount={3} pendingDelete={2} />);
        screen.getByText('Yes').focus();
        fireEvent.click(screen.getByText('Yes'));
        rerender(<MeasureControls {...defaultProps} measureCount={2} pendingDelete={null} />);
        expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Delete measure 2' }));
    });

    it('leaves focus alone when the confirmation was resolved by pointer elsewhere', () => {
        const { rerender } = render(
            <>
                <button data-testid="outside">outside</button>
                <MeasureControls {...defaultProps} pendingDelete={1} />
            </>
        );
        fireEvent.click(screen.getByText('No'));
        screen.getByTestId('outside').focus();
        rerender(
            <>
                <button data-testid="outside">outside</button>
                <MeasureControls {...defaultProps} pendingDelete={null} />
            </>
        );
        expect(document.activeElement).toBe(screen.getByTestId('outside'));
    });
});
