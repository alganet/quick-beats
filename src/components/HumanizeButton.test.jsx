// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import HumanizeButton from './HumanizeButton';

const setup = (status = 'off') => {
    const onClick = vi.fn();
    const utils = render(<HumanizeButton status={status} onClick={onClick} />);
    return { onClick, ...utils };
};

const useHref = (container) => container.querySelector('use').getAttribute('href');

describe('HumanizeButton', () => {
    it('off: muted, not pressed, clicking triggers the action (humanize)', () => {
        const { onClick, container } = setup('off');
        const btn = screen.getByRole('button', { name: 'Humanize' });
        expect(btn.className).toContain('bg-surface-5');
        expect(btn).toHaveAttribute('aria-pressed', 'false');
        expect(useHref(container)).toBe('#icon-humanize');
        fireEvent.click(btn);
        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('on: lit/pressed, clicking triggers the action (turn off)', () => {
        const { onClick } = setup('on');
        const btn = screen.getByRole('button', { name: 'Humanize' });
        expect(btn.className).toContain('bg-surface-inverted');
        expect(btn).toHaveAttribute('aria-pressed', 'true');
        fireEvent.click(btn);
        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('pending: lit with a "!" badge, clicking still turns off', () => {
        const { onClick } = setup('pending');
        const btn = screen.getByRole('button', { name: 'Humanize' });
        expect(btn.className).toContain('bg-surface-inverted');
        expect(btn).toHaveTextContent('!');
        fireEvent.click(btn);
        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('computing: spinner, busy, lit; clicking still toggles (cancel)', () => {
        const { onClick, container } = setup('computing');
        const btn = screen.getByRole('button', { name: 'Humanize' });
        expect(btn).not.toBeDisabled();
        expect(btn).toHaveAttribute('aria-busy', 'true');
        expect(btn).toHaveAttribute('aria-pressed', 'true');
        expect(useHref(container)).toBe('#icon-spinner');
        fireEvent.click(btn);
        expect(onClick).toHaveBeenCalledTimes(1);
    });

    describe('unavailable (incompatible signature)', () => {
        it('is aria-disabled with a faded icon and an explanatory popover', () => {
            const { onClick, container } = setup('unavailable');
            const btn = screen.getByRole('button');
            expect(btn).toHaveAttribute('aria-disabled', 'true');
            expect(container.querySelector('.opacity-30')).toBeTruthy();
            fireEvent.click(btn);
            expect(screen.getByRole('tooltip')).toHaveTextContent(/16th-note/i);
            expect(onClick).not.toHaveBeenCalled();
        });

        it('closes the popover on Escape', () => {
            setup('unavailable');
            fireEvent.click(screen.getByRole('button'));
            expect(screen.getByRole('tooltip')).toBeInTheDocument();
            fireEvent.keyDown(document, { key: 'Escape' });
            expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
        });

        it('does not open on hover (click/focus only; hover is loading-only)', () => {
            const { container } = setup('unavailable');
            fireEvent.mouseEnter(container.firstChild);
            expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
        });
    });

    describe('loading (model downloading)', () => {
        const renderLoading = (progress = 0.5) => {
            const onClick = vi.fn();
            const utils = render(<HumanizeButton status="loading" progress={progress} onClick={onClick} />);
            return { onClick, ...utils };
        };

        it('is non-interactive, busy, and shows a progress ring', () => {
            const { onClick, container } = renderLoading(0.5);
            const btn = screen.getByRole('button');
            expect(btn).toHaveAttribute('aria-disabled', 'true');
            expect(btn).toHaveAttribute('aria-busy', 'true');
            // The ring is an SVG with a progress stroke; the person icon sits inside it.
            expect(container.querySelector('svg circle.stroke-primary')).toBeTruthy();
            expect(useHref(container)).toBe('#icon-humanize');
            fireEvent.click(btn);
            expect(onClick).not.toHaveBeenCalled();
        });

        it('shows a friendly popover with the percent on click', () => {
            renderLoading(0.42);
            fireEvent.click(screen.getByRole('button'));
            const tip = screen.getByRole('tooltip');
            expect(tip).toHaveTextContent(/only happens once/i);
            expect(tip).toHaveTextContent('42%');
        });

        it('opens the popover on hover', () => {
            const { container } = renderLoading();
            expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
            fireEvent.mouseEnter(container.firstChild);
            expect(screen.getByRole('tooltip')).toBeInTheDocument();
            fireEvent.mouseLeave(container.firstChild);
            expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
        });
    });

    describe('error', () => {
        it('shows an error popover with a working Retry button', () => {
            const { onClick } = setup('error');
            fireEvent.click(screen.getByRole('button'));
            expect(screen.getByRole('tooltip')).toHaveTextContent(/couldn't load/i);
            fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
            expect(onClick).toHaveBeenCalledTimes(1);
        });
    });
});
