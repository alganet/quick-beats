// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Controls from './Controls';
import { IconSprite } from './Icons';

// Wrapper to provide icon sprite
const renderWithSprite = (ui) => {
    return render(
        <>
            <IconSprite />
            {ui}
        </>
    );
};

describe('Controls', () => {
    it('should render play button when not playing', () => {
        const togglePlay = vi.fn();
        const setBpm = vi.fn();

        renderWithSprite(
            <Controls isPlaying={false} togglePlay={togglePlay} bpm={120} setBpm={setBpm} />
        );

        const playButton = screen.getByRole('button', { name: /play/i });
        expect(playButton).toBeInTheDocument();
    });

    it('should render stop button when playing', () => {
        const togglePlay = vi.fn();
        const setBpm = vi.fn();

        renderWithSprite(
            <Controls isPlaying={true} togglePlay={togglePlay} bpm={120} setBpm={setBpm} />
        );

        const stopButton = screen.getByRole('button', { name: /stop/i });
        expect(stopButton).toBeInTheDocument();
    });

    it('should call togglePlay when play button is clicked', () => {
        const togglePlay = vi.fn();
        const setBpm = vi.fn();

        renderWithSprite(
            <Controls isPlaying={false} togglePlay={togglePlay} bpm={120} setBpm={setBpm} />
        );

        const playButton = screen.getByRole('button', { name: /play/i });
        fireEvent.click(playButton);

        expect(togglePlay).toHaveBeenCalledTimes(1);
    });

    it('should display current BPM value', () => {
        const togglePlay = vi.fn();
        const setBpm = vi.fn();

        renderWithSprite(
            <Controls isPlaying={false} togglePlay={togglePlay} bpm={140} setBpm={setBpm} />
        );

        expect(screen.getByText('140')).toBeInTheDocument();
    });

    it('should render tempo slider with correct value', () => {
        const togglePlay = vi.fn();
        const setBpm = vi.fn();

        renderWithSprite(
            <Controls isPlaying={false} togglePlay={togglePlay} bpm={120} setBpm={setBpm} />
        );

        const slider = screen.getByRole('slider');
        expect(slider).toHaveValue('120');
    });

    it('should call setBpm when slider is changed', () => {
        const togglePlay = vi.fn();
        const setBpm = vi.fn();

        renderWithSprite(
            <Controls isPlaying={false} togglePlay={togglePlay} bpm={120} setBpm={setBpm} />
        );

        const slider = screen.getByRole('slider');
        fireEvent.change(slider, { target: { value: '150' } });

        expect(setBpm).toHaveBeenCalledWith(150);
    });

    it('should have slider with min 60 and max 200', () => {
        const togglePlay = vi.fn();
        const setBpm = vi.fn();

        renderWithSprite(
            <Controls isPlaying={false} togglePlay={togglePlay} bpm={120} setBpm={setBpm} />
        );

        const slider = screen.getByRole('slider');
        expect(slider).toHaveAttribute('min', '60');
        expect(slider).toHaveAttribute('max', '200');
    });
});
