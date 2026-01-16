// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Setup from './Setup';
import { IconSprite } from './Icons';
import { COMMON_SIGNATURES } from '../data/signatures';

// Wrapper to provide icon sprite
const renderWithSprite = (ui) => {
    return render(
        <>
            <IconSprite />
            {ui}
        </>
    );
};

describe('Setup', () => {
    const defaultProps = {
        onSelect: vi.fn(),
        onConfirm: vi.fn(),
        selectedSig: null,
        onShowHelp: vi.fn(),
    };

    it('should render the title', () => {
        renderWithSprite(<Setup {...defaultProps} />);

        expect(screen.getByText('Quick Beats')).toBeInTheDocument();
    });

    it('should render subtitle', () => {
        renderWithSprite(<Setup {...defaultProps} />);

        expect(screen.getByText('Select Tempo & Preview')).toBeInTheDocument();
    });

    it('should render all common signatures', () => {
        renderWithSprite(<Setup {...defaultProps} />);

        COMMON_SIGNATURES.forEach(sig => {
            expect(screen.getByText(sig.name)).toBeInTheDocument();
            expect(screen.getByText(sig.label)).toBeInTheDocument();
            expect(screen.getByText(sig.description)).toBeInTheDocument();
        });
    });

    it('should call onSelect when a signature is clicked', () => {
        const onSelect = vi.fn();
        renderWithSprite(<Setup {...defaultProps} onSelect={onSelect} />);

        const fourFourButton = screen.getByText('4/4').closest('button');
        fireEvent.click(fourFourButton);

        expect(onSelect).toHaveBeenCalledWith(
            expect.objectContaining({ name: '4/4' })
        );
    });

    it('should not show confirm button when no signature is selected', () => {
        renderWithSprite(<Setup {...defaultProps} selectedSig={null} />);

        expect(screen.queryByText('Confirm & Start')).not.toBeInTheDocument();
    });

    it('should show confirm button when a signature is selected', () => {
        const selectedSig = COMMON_SIGNATURES[0];
        renderWithSprite(<Setup {...defaultProps} selectedSig={selectedSig} />);

        expect(screen.getByText('Confirm & Start')).toBeInTheDocument();
    });

    it('should call onConfirm when confirm button is clicked', () => {
        const onConfirm = vi.fn();
        const selectedSig = COMMON_SIGNATURES[0];
        renderWithSprite(
            <Setup {...defaultProps} onConfirm={onConfirm} selectedSig={selectedSig} />
        );

        const confirmButton = screen.getByText('Confirm & Start');
        fireEvent.click(confirmButton);

        expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it('should call onShowHelp when version button is clicked', () => {
        const onShowHelp = vi.fn();
        renderWithSprite(<Setup {...defaultProps} onShowHelp={onShowHelp} />);

        const versionButton = screen.getByText('v1.0.2');
        fireEvent.click(versionButton);

        expect(onShowHelp).toHaveBeenCalledTimes(1);
    });

    it('should highlight the selected signature', () => {
        const selectedSig = COMMON_SIGNATURES.find(s => s.name === '4/4');
        renderWithSprite(<Setup {...defaultProps} selectedSig={selectedSig} />);

        const fourFourButton = screen.getByText('4/4').closest('button');
        // Check that it has the selected border class
        expect(fourFourButton).toHaveClass('border-[#3b82f6]');
    });

    it('should show pulse indicator on selected signature', () => {
        const selectedSig = COMMON_SIGNATURES.find(s => s.name === '3/4');
        const { container } = renderWithSprite(
            <Setup {...defaultProps} selectedSig={selectedSig} />
        );

        // The pulse indicator is a div with animate-pulse class
        const pulseIndicator = container.querySelector('.animate-pulse');
        expect(pulseIndicator).toBeInTheDocument();
    });
});
