// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ShareModal from './ShareModal';

// Mock navigator.clipboard
beforeEach(() => {
    Object.assign(navigator, {
        clipboard: {
            writeText: vi.fn().mockResolvedValue(undefined),
        },
    });
});

describe('ShareModal', () => {
    const defaultProps = {
        isOpen: true,
        onClose: vi.fn(),
        shareUrl: 'https://example.com/drums#120|4/4|pattern',
    };

    it('should not render when isOpen is false', () => {
        render(<ShareModal isOpen={false} onClose={vi.fn()} shareUrl="test" />);

        expect(screen.queryByText('Share Beat')).not.toBeInTheDocument();
    });

    it('should render modal when isOpen is true', () => {
        render(<ShareModal {...defaultProps} />);

        expect(screen.getByText('Share Beat')).toBeInTheDocument();
    });

    it('should display the share URL', () => {
        render(<ShareModal {...defaultProps} />);

        expect(screen.getByText(defaultProps.shareUrl)).toBeInTheDocument();
    });

    it('should call onClose when close button is clicked', () => {
        const onClose = vi.fn();
        render(<ShareModal {...defaultProps} onClose={onClose} />);

        const closeButtons = screen.getAllByRole('button');
        // Click the X button (first close button)
        fireEvent.click(closeButtons[0]);

        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when bottom Close button is clicked', () => {
        const onClose = vi.fn();
        render(<ShareModal {...defaultProps} onClose={onClose} />);

        const closeButton = screen.getByRole('button', { name: /close/i });
        fireEvent.click(closeButton);

        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should copy URL to clipboard when Copy button is clicked', async () => {
        render(<ShareModal {...defaultProps} />);

        const copyButton = screen.getByRole('button', { name: /copy/i });
        fireEvent.click(copyButton);

        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(defaultProps.shareUrl);
    });

    it('should show "Copied" text after clicking copy', async () => {
        render(<ShareModal {...defaultProps} />);

        const copyButton = screen.getByRole('button', { name: /copy/i });
        fireEvent.click(copyButton);

        expect(screen.getByText('Copied')).toBeInTheDocument();
    });

    it('should display instructions', () => {
        render(<ShareModal {...defaultProps} />);

        expect(screen.getByText(/copy the link above/i)).toBeInTheDocument();
        expect(screen.getByText(/anyone with the link/i)).toBeInTheDocument();
    });

    it('should display step numbers', () => {
        render(<ShareModal {...defaultProps} />);

        expect(screen.getByText('1')).toBeInTheDocument();
        expect(screen.getByText('2')).toBeInTheDocument();
    });
});
