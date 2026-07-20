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
        // Play / Pause is p alone — Space is unbound as a global shortcut (it
        // keeps its native roles) and must not be advertised as one.
        expect(screen.getAllByText('Play / Pause')).toHaveLength(1);
        expect(screen.getByText('p')).toBeInTheDocument();
        expect(screen.queryByText('Space')).not.toBeInTheDocument();
        expect(screen.getByText('Toggle zoom')).toBeInTheDocument();
        // The previously-undocumented shortcuts that actually exist.
        expect(screen.getByText('First step')).toBeInTheDocument();
        expect(screen.getByText('Last step')).toBeInTheDocument();
        // Fill patterns opens from the Menu key or its m fallback.
        expect(screen.getAllByText('Fill patterns')).toHaveLength(2);
        expect(screen.getByText('m')).toBeInTheDocument();
        expect(screen.getByText(/seek the playhead/i)).toBeInTheDocument();
    });

    it('does not show keyboard cheatsheet when showKeyboardCheatsheet=false', () => {
        render(<Help isOpen={true} onClose={() => {}} showKeyboardCheatsheet={false} />);
        expect(screen.queryByText('Keyboard Shortcuts')).not.toBeInTheDocument();
    });

    it('shows the iOS add-to-home-screen hint only when asked', () => {
        const { rerender } = render(<Help isOpen={true} onClose={() => {}} />);
        expect(screen.queryByText('Install app')).not.toBeInTheDocument();

        rerender(<Help isOpen={true} onClose={() => {}} showIosInstallHint={true} />);
        expect(screen.getByText('Install app')).toBeInTheDocument();
        expect(screen.getByText(/Add to Home Screen/i)).toBeInTheDocument();
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

        expect(screen.getByText('Drum Sounds')).toBeInTheDocument();
        expect(screen.getByText('Long Press — Fill Patterns')).toBeInTheDocument();
        expect(screen.getByText('Adding Measures')).toBeInTheDocument();
        expect(screen.getByText('Deleting Measures')).toBeInTheDocument();
        expect(screen.getByText('About')).toBeInTheDocument();
    });

    // The escape hatch for anyone whose speech-input or assistive software sends
    // bare letters: it is the one control in here that changes how the app
    // listens, and none of it — presence, state, or click — was covered.
    describe('single-key shortcuts toggle', () => {
        const open = (props) => render(
            <Help isOpen onClose={() => {}} showKeyboardCheatsheet {...props} />,
        );
        const toggle = () => screen.getByRole('button', { name: /single-key shortcuts/i });

        it('is absent when the host provides no toggle handler', () => {
            open({});
            expect(screen.queryByRole('button', { name: /single-key shortcuts/i })).not.toBeInTheDocument();
        });

        it.each([
            ['on', true, 'Single-key shortcuts: On'],
            ['off', false, 'Single-key shortcuts: Off'],
        ])('reports state %s to assistive tech and in its label', (_label, singleKeyShortcuts, text) => {
            open({ singleKeyShortcuts, onToggleSingleKeyShortcuts: vi.fn() });

            expect(toggle()).toHaveAttribute('aria-pressed', String(singleKeyShortcuts));
            expect(toggle()).toHaveTextContent(text);
        });

        it('calls back on click', () => {
            const onToggleSingleKeyShortcuts = vi.fn();
            open({ singleKeyShortcuts: true, onToggleSingleKeyShortcuts });

            fireEvent.click(toggle());

            expect(onToggleSingleKeyShortcuts).toHaveBeenCalledTimes(1);
        });
    });

    describe('dialog semantics', () => {
        it('exposes itself as a modal dialog labelled by its heading', () => {
            render(<Help isOpen onClose={() => {}} />);

            const dialog = screen.getByRole('dialog');
            expect(dialog).toHaveAttribute('aria-modal', 'true');
            expect(dialog).toHaveAttribute('aria-labelledby', 'help-title');
            expect(document.getElementById('help-title')).toHaveTextContent('How to Use');
        });

        it('closes on Escape pressed inside the dialog', () => {
            // Wired through useDialog, which listens on the dialog element rather
            // than on document — deliberately, so the press is stopped there and
            // neither the global shortcut handler nor a dialog underneath acts on
            // it. The button says "Close [ESC]", so the key has to work.
            const onClose = vi.fn();
            render(<Help isOpen onClose={onClose} />);

            fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

            expect(onClose).toHaveBeenCalledTimes(1);
        });

        it('moves focus into the dialog on open', () => {
            render(<Help isOpen onClose={() => {}} />);
            expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
        });
    });
});
