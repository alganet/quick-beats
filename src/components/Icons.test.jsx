// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { IconSprite, Icon } from './Icons';

describe('Icons', () => {
    describe('IconSprite', () => {
        it('should render an SVG element', () => {
            const { container } = render(<IconSprite />);

            const svg = container.querySelector('svg');
            expect(svg).toBeInTheDocument();
        });

        it('should be hidden from view', () => {
            const { container } = render(<IconSprite />);

            const svg = container.querySelector('svg');
            expect(svg).toHaveStyle({ display: 'none' });
        });

        it('should contain icon symbols', () => {
            const { container } = render(<IconSprite />);

            const symbols = container.querySelectorAll('symbol');
            expect(symbols.length).toBeGreaterThan(0);
        });

        it('should contain play icon symbol', () => {
            const { container } = render(<IconSprite />);

            const playSymbol = container.querySelector('#icon-play');
            expect(playSymbol).toBeInTheDocument();
        });

        it('should contain stop icon symbol', () => {
            const { container } = render(<IconSprite />);

            const stopSymbol = container.querySelector('#icon-stop');
            expect(stopSymbol).toBeInTheDocument();
        });

        it('should contain drum-related icon symbols', () => {
            const { container } = render(<IconSprite />);

            expect(container.querySelector('#icon-kick')).toBeInTheDocument();
            expect(container.querySelector('#icon-snare')).toBeInTheDocument();
            expect(container.querySelector('#icon-hihat-closed')).toBeInTheDocument();
            expect(container.querySelector('#icon-hihat-open')).toBeInTheDocument();
            expect(container.querySelector('#icon-tom')).toBeInTheDocument();
            expect(container.querySelector('#icon-crash')).toBeInTheDocument();
            expect(container.querySelector('#icon-ride')).toBeInTheDocument();
        });
    });

    describe('Icon', () => {
        it('should render an SVG element', () => {
            render(
                <>
                    <IconSprite />
                    <Icon id="play" />
                </>
            );

            const svgs = document.querySelectorAll('svg');
            // IconSprite + Icon = 2 svgs
            expect(svgs.length).toBe(2);
        });

        it('should apply default className', () => {
            render(
                <>
                    <IconSprite />
                    <Icon id="play" />
                </>
            );

            const svgs = document.querySelectorAll('svg');
            const iconSvg = svgs[1];
            expect(iconSvg).toHaveClass('w-6', 'h-6');
        });

        it('should apply custom className', () => {
            render(
                <>
                    <IconSprite />
                    <Icon id="play" className="w-10 h-10 text-red-500" />
                </>
            );

            const svgs = document.querySelectorAll('svg');
            const iconSvg = svgs[1];
            expect(iconSvg).toHaveClass('w-10', 'h-10', 'text-red-500');
        });

        it('should reference correct icon via use element', () => {
            const { container } = render(
                <>
                    <IconSprite />
                    <Icon id="stop" />
                </>
            );

            const useElement = container.querySelector('use');
            expect(useElement).toHaveAttribute('href', '#icon-stop');
        });

        it('should be presentational without title', () => {
            render(
                <>
                    <IconSprite />
                    <Icon id="play" />
                </>
            );

            const svgs = document.querySelectorAll('svg');
            const iconSvg = svgs[1];
            expect(iconSvg).toHaveAttribute('aria-hidden', 'true');
            expect(iconSvg).toHaveAttribute('role', 'presentation');
        });

        it('should be accessible with title', () => {
            render(
                <>
                    <IconSprite />
                    <Icon id="play" title="Play music" />
                </>
            );

            const svgs = document.querySelectorAll('svg');
            const iconSvg = svgs[1];
            expect(iconSvg).toHaveAttribute('aria-hidden', 'false');
            expect(iconSvg).toHaveAttribute('role', 'img');
            expect(screen.getByText('Play music')).toBeInTheDocument();
        });
    });
});
