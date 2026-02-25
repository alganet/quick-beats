// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Help from './Help';

describe('Help', () => {
    it('renders the help content', () => {
        render(<Help isOpen={true} onClose={() => {}} />);
        expect(screen.getByText('How to Use')).toBeInTheDocument();
        expect(screen.getByText('Auto-Scroll')).toBeInTheDocument();
        expect(screen.getByText('Zoom')).toBeInTheDocument();
    });

    it('shows keyboard cheatsheet when showKeyboardCheatsheet=true', () => {
        render(<Help isOpen={true} onClose={() => {}} showKeyboardCheatsheet={true} />);
        expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();
        expect(screen.getByText('Play / Pause')).toBeInTheDocument();
        expect(screen.getByText('Toggle zoom')).toBeInTheDocument();
    });

    it('does not show keyboard cheatsheet when showKeyboardCheatsheet=false', () => {
        render(<Help isOpen={true} onClose={() => {}} showKeyboardCheatsheet={false} />);
        expect(screen.queryByText('Keyboard Shortcuts')).not.toBeInTheDocument();
    });

    it('returns null when not open', () => {
        const { container } = render(<Help isOpen={false} onClose={() => {}} />);
        expect(container.firstChild).toBeNull();
    });

    it('calls onClose when close button is clicked', () => {
        const onClose = vi.fn();
        render(<Help isOpen={true} onClose={onClose} />);
        const closeButton = screen.getByText('Close [ESC]');
        fireEvent.click(closeButton);
        expect(onClose).toHaveBeenCalled();
    });

    it('calls onClose when Got it button is clicked', () => {
        const onClose = vi.fn();
        render(<Help isOpen={true} onClose={onClose} />);
        const gotItButton = screen.getByText('Got it');
        fireEvent.click(gotItButton);
        expect(onClose).toHaveBeenCalled();
    });

    it('cycles through zoom levels when zoom button is clicked', () => {
        render(<Help isOpen={true} onClose={() => {}} />);

        expect(screen.getByText('Medium')).toBeInTheDocument();

        const zoomButtons = screen.getAllByRole('button');
        const zoomButton = zoomButtons.find(btn => btn.querySelector('svg use[href="#icon-zoom-1"]'));
        expect(zoomButton).toBeTruthy();
        fireEvent.click(zoomButton);
        expect(screen.getByText('Large')).toBeInTheDocument();
        fireEvent.click(zoomButton);
        expect(screen.getByText('Small')).toBeInTheDocument();
        fireEvent.click(zoomButton);
        expect(screen.getByText('Medium')).toBeInTheDocument();
    });

    it('renders all help sections', () => {
        render(<Help isOpen={true} onClose={() => {}} />);

        expect(screen.getByText('Long Press — Fill Patterns')).toBeInTheDocument();
        expect(screen.getByText('Adding Measures')).toBeInTheDocument();
        expect(screen.getByText('Deleting Measures')).toBeInTheDocument();
        expect(screen.getByText('About')).toBeInTheDocument();
    });
});
