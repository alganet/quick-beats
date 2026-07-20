// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useDialog } from './useDialog';

function Dialog({ isOpen, onClose }) {
    const ref = useDialog(isOpen, onClose);
    if (!isOpen) return null;
    return (
        <div ref={ref} role="dialog" aria-modal="true" aria-label="Test dialog">
            <button>first</button>
            <button>last</button>
        </div>
    );
}

function Harness({ isOpen, onClose }) {
    return (
        <>
            <button>opener</button>
            <Dialog isOpen={isOpen} onClose={onClose} />
        </>
    );
}

describe('useDialog', () => {
    it('moves focus to the first focusable control on open', () => {
        const { rerender } = render(<Harness isOpen={false} />);
        screen.getByText('opener').focus();

        rerender(<Harness isOpen={true} />);
        expect(document.activeElement).toBe(screen.getByText('first'));
    });

    it('traps Tab at the ends of the dialog', () => {
        render(<Harness isOpen={true} />);
        const first = screen.getByText('first');
        const last = screen.getByText('last');

        last.focus();
        fireEvent.keyDown(last, { key: 'Tab' });
        expect(document.activeElement).toBe(first);

        fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });
        expect(document.activeElement).toBe(last);
    });

    it('closes on Escape and stops the event from bubbling further', () => {
        const onClose = vi.fn();
        const windowSpy = vi.fn();
        window.addEventListener('keydown', windowSpy);
        render(<Harness isOpen={true} onClose={onClose} />);

        fireEvent.keyDown(screen.getByText('first'), { key: 'Escape' });
        expect(onClose).toHaveBeenCalledTimes(1);
        expect(windowSpy).not.toHaveBeenCalled();

        window.removeEventListener('keydown', windowSpy);
    });

    it('does not close on Escape when no onClose is given (ErrorModal)', () => {
        render(<Harness isOpen={true} />);
        // Nothing to assert beyond "does not throw"; focus still moved in.
        fireEvent.keyDown(screen.getByText('first'), { key: 'Escape' });
        expect(document.activeElement).toBe(screen.getByText('first'));
    });

    it('restores focus to the opener on close', () => {
        const { rerender } = render(<Harness isOpen={false} />);
        const opener = screen.getByText('opener');
        opener.focus();

        rerender(<Harness isOpen={true} />);
        expect(document.activeElement).not.toBe(opener);

        rerender(<Harness isOpen={false} />);
        expect(document.activeElement).toBe(opener);
    });
});
