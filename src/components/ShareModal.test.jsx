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

        // Both the × and the bottom button carry the accessible name "Close" —
        // the × via aria-label, since "×" would announce as "times".
        const closeButtons = screen.getAllByRole('button', { name: /close/i });
        expect(closeButtons).toHaveLength(2);
        fireEvent.click(closeButtons[0]);

        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when bottom Close button is clicked', () => {
        const onClose = vi.fn();
        render(<ShareModal {...defaultProps} onClose={onClose} />);

        fireEvent.click(screen.getByText('Close'));

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

        expect(await screen.findByText('Copied')).toBeInTheDocument();
    });

    it('shows a fallback hint when the clipboard write rejects', async () => {
        navigator.clipboard.writeText = vi.fn().mockRejectedValue(new Error('denied'));
        render(<ShareModal {...defaultProps} />);

        fireEvent.click(screen.getByRole('button', { name: /copy/i }));

        expect(await screen.findByText(/select the link above/i)).toBeInTheDocument();
        expect(screen.queryByText('Copied')).not.toBeInTheDocument();
    });

    it('should display sharing options', () => {
        render(<ShareModal {...defaultProps} />);

        expect(screen.getByText(/instantly share with one click:/i)).toBeInTheDocument();
        expect(screen.getByText(/or copy the direct link:/i)).toBeInTheDocument();

        // Check social links exist
        const twitterLink = screen.getByRole('link', { name: /x/i });
        const whatsappLink = screen.getByRole('link', { name: /whatsapp/i });
        const telegramLink = screen.getByRole('link', { name: /telegram/i });

        expect(twitterLink).toBeInTheDocument();
        expect(whatsappLink).toBeInTheDocument();
        expect(telegramLink).toBeInTheDocument();

        expect(twitterLink).toHaveAttribute('href', expect.stringContaining('twitter.com'));
        expect(whatsappLink).toHaveAttribute('href', expect.stringContaining('whatsapp.com'));
        expect(telegramLink).toHaveAttribute('href', expect.stringContaining('t.me'));
    });
});
