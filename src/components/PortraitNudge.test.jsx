// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import PortraitNudge from './PortraitNudge';

vi.mock('./Icons', () => ({
    Icon: ({ id }) => <span data-testid={`icon-${id}`} />,
}));

describe('PortraitNudge', () => {
    it('offers to rotate when the device can be rotated', () => {
        render(<PortraitNudge canRotate onRotate={vi.fn()} onDismiss={vi.fn()} />);

        expect(screen.getByRole('button', { name: 'Rotate' })).toBeInTheDocument();
        expect(screen.getByText('More room in landscape')).toBeInTheDocument();
    });

    it('degrades to a plain instruction where rotation cannot be performed', () => {
        // All of iOS: there is no orientation lock to call, so offering a button
        // that does nothing is worse than asking.
        render(<PortraitNudge canRotate={false} onRotate={vi.fn()} onDismiss={vi.fn()} />);

        expect(screen.queryByRole('button', { name: 'Rotate' })).not.toBeInTheDocument();
        expect(screen.getByText('Turn your device sideways for more room')).toBeInTheDocument();
    });

    it('rotates on click', () => {
        const onRotate = vi.fn();
        render(<PortraitNudge canRotate onRotate={onRotate} onDismiss={vi.fn()} />);

        fireEvent.click(screen.getByRole('button', { name: 'Rotate' }));

        expect(onRotate).toHaveBeenCalledTimes(1);
    });

    it('dismisses on click, in both rotation modes', () => {
        const onDismiss = vi.fn();
        const { rerender } = render(<PortraitNudge canRotate onRotate={vi.fn()} onDismiss={onDismiss} />);

        fireEvent.click(screen.getByRole('button', { name: 'Dismiss landscape hint' }));
        rerender(<PortraitNudge canRotate={false} onRotate={vi.fn()} onDismiss={onDismiss} />);
        fireEvent.click(screen.getByRole('button', { name: 'Dismiss landscape hint' }));

        expect(onDismiss).toHaveBeenCalledTimes(2);
    });

    it('keeps the dismiss target at the 24px WCAG 2.5.8 minimum', () => {
        // The × glyph is narrow, so sizing the button to its content puts the
        // target under the minimum. It is held open by these two classes and
        // nothing else — a styling tidy-up is exactly what would regress it.
        render(<PortraitNudge canRotate onRotate={vi.fn()} onDismiss={vi.fn()} />);

        const dismiss = screen.getByRole('button', { name: 'Dismiss landscape hint' });
        expect(dismiss).toHaveClass('h-6', 'w-6');
    });
});
