// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DrumKitButton from './DrumKitButton';
import { IconSprite } from './Icons';

const KITS = {
    'black-pearl': { name: 'Black Pearl', samples: {} },
    'red-zeppelin': { name: 'Red Zeppelin', samples: {} },
};

const renderWithSprite = (ui) => render(<><IconSprite />{ui}</>);

describe('DrumKitButton', () => {
    it('labels the trigger with the active kit and stays closed initially', () => {
        renderWithSprite(<DrumKitButton kits={KITS} activeKit="black-pearl" onSelectKit={vi.fn()} />);
        expect(screen.getByRole('button', { name: /drum kit: black pearl/i })).toBeInTheDocument();
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    it('opens a popover listing every kit, marking the active one', () => {
        renderWithSprite(<DrumKitButton kits={KITS} activeKit="black-pearl" onSelectKit={vi.fn()} />);
        fireEvent.click(screen.getByRole('button', { name: /drum kit/i }));

        expect(screen.getByRole('menu')).toBeInTheDocument();
        const items = screen.getAllByRole('menuitemradio');
        expect(items).toHaveLength(2);
        expect(screen.getByRole('menuitemradio', { name: /black pearl/i })).toHaveAttribute('aria-checked', 'true');
        expect(screen.getByRole('menuitemradio', { name: /red zeppelin/i })).toHaveAttribute('aria-checked', 'false');
    });

    it('hangs the popover off the right edge by default', () => {
        renderWithSprite(<DrumKitButton kits={KITS} activeKit="black-pearl" onSelectKit={vi.fn()} />);
        fireEvent.click(screen.getByRole('button', { name: /drum kit/i }));
        expect(screen.getByRole('menu')).toHaveClass('right-0');
    });

    it('honours a caller-supplied anchor, for buttons sitting against the left edge', () => {
        // A right-anchored 12rem popover opens off-screen when the trigger is at
        // the left of the viewport, as it is in Setup's landscape branding column.
        renderWithSprite(
            <DrumKitButton
                kits={KITS} activeKit="black-pearl" onSelectKit={vi.fn()}
                menuClassName="right-0 short-landscape:right-auto short-landscape:left-0"
                arrowClassName="right-3 short-landscape:right-auto short-landscape:left-3"
            />
        );
        fireEvent.click(screen.getByRole('button', { name: /drum kit/i }));

        const menu = screen.getByRole('menu');
        expect(menu).toHaveClass('short-landscape:left-0');
        expect(menu).toHaveClass('short-landscape:right-auto');
        expect(menu.firstElementChild).toHaveClass('short-landscape:left-3');
    });

    it('fires onSelectKit with the chosen kit id', () => {
        const onSelectKit = vi.fn();
        renderWithSprite(<DrumKitButton kits={KITS} activeKit="black-pearl" onSelectKit={onSelectKit} />);
        fireEvent.click(screen.getByRole('button', { name: /drum kit/i }));
        fireEvent.click(screen.getByRole('menuitemradio', { name: /red zeppelin/i }));
        expect(onSelectKit).toHaveBeenCalledWith('red-zeppelin');
    });

    it('marks the button busy and reflects the loading kit while switching', () => {
        renderWithSprite(
            <DrumKitButton kits={KITS} activeKit="black-pearl" switchingTo="red-zeppelin" progress={0.4} onSelectKit={vi.fn()} />,
        );
        const trigger = screen.getByRole('button', { name: /loading red zeppelin/i });
        expect(trigger).toHaveAttribute('aria-busy', 'true');
    });

    it('closes on Escape', () => {
        renderWithSprite(<DrumKitButton kits={KITS} activeKit="black-pearl" onSelectKit={vi.fn()} />);
        fireEvent.click(screen.getByRole('button', { name: /drum kit/i }));
        expect(screen.getByRole('menu')).toBeInTheDocument();
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
});
