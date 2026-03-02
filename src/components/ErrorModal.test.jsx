// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ErrorModal from './ErrorModal';

describe('ErrorModal', () => {
    it('should not render when isOpen is false', () => {
        render(<ErrorModal isOpen={false} onGoHome={vi.fn()} />);
        expect(screen.queryByText(/oops/i)).not.toBeInTheDocument();
    });

    it('should render modal when isOpen is true', () => {
        render(<ErrorModal isOpen={true} onGoHome={vi.fn()} />);
        expect(screen.getByText(/oops/i)).toBeInTheDocument();
    });

    it('should display the error message', () => {
        render(<ErrorModal isOpen={true} onGoHome={vi.fn()} />);
        expect(screen.getByText(/something unexpected happened/i)).toBeInTheDocument();
    });

    it('should display the refresh button', () => {
        render(<ErrorModal isOpen={true} onGoHome={vi.fn()} />);
        expect(screen.getByRole('button', { name: /go home & refresh/i })).toBeInTheDocument();
    });

    it('should call onGoHome when button is clicked', () => {
        const onGoHome = vi.fn();
        render(<ErrorModal isOpen={true} onGoHome={onGoHome} />);

        fireEvent.click(screen.getByRole('button', { name: /go home & refresh/i }));
        expect(onGoHome).toHaveBeenCalledTimes(1);
    });
});
