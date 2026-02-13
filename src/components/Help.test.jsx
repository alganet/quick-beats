// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
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
});
