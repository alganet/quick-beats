// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(0);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

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

        expect(screen.getByText(/140/)).toBeInTheDocument();
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

    it('should have slider with min 60 and max 240', () => {
        const togglePlay = vi.fn();
        const setBpm = vi.fn();

        renderWithSprite(
            <Controls isPlaying={false} togglePlay={togglePlay} bpm={120} setBpm={setBpm} />
        );

        const slider = screen.getByRole('slider');
        expect(slider).toHaveAttribute('min', '60');
        expect(slider).toHaveAttribute('max', '240');
    });

    it('should render auto-scroll toggle', () => {
        const togglePlay = vi.fn();
        const setBpm = vi.fn();
        const setAutoScroll = vi.fn();

        renderWithSprite(
            <Controls isPlaying={true} togglePlay={togglePlay} bpm={120} setBpm={setBpm} autoScroll={true} setAutoScroll={setAutoScroll} canScroll={true} />
        );

        const toggle = screen.getByRole('button', { name: /toggle auto-scroll/i });
        expect(toggle).toBeInTheDocument();
        expect(toggle).toHaveAttribute('title', 'Auto-scroll ON [s]');
    });

    it('should call setAutoScroll when toggle is clicked', () => {
        const togglePlay = vi.fn();
        const setBpm = vi.fn();
        const setAutoScroll = vi.fn();

        renderWithSprite(
            <Controls isPlaying={true} togglePlay={togglePlay} bpm={120} setBpm={setBpm} autoScroll={true} setAutoScroll={setAutoScroll} canScroll={true} />
        );

        const toggle = screen.getByRole('button', { name: /toggle auto-scroll/i });
        fireEvent.click(toggle);

        expect(setAutoScroll).not.toHaveBeenCalled();
        vi.advanceTimersByTime(210);
        expect(setAutoScroll).toHaveBeenCalled();
    });
    it('should NOT render auto-scroll toggle when canScroll is false', () => {
        const togglePlay = vi.fn();
        const setBpm = vi.fn();
        const setAutoScroll = vi.fn();

        renderWithSprite(
            <Controls isPlaying={false} togglePlay={togglePlay} bpm={120} setBpm={setBpm} autoScroll={true} setAutoScroll={setAutoScroll} canScroll={false} />
        );

        const toggle = screen.queryByRole('button', { name: /toggle auto-scroll/i });
        expect(toggle).not.toBeInTheDocument();
    });

    it('should call setZoom when zoom toggle is clicked', () => {
        const togglePlay = vi.fn();
        const setBpm = vi.fn();
        const setZoom = vi.fn();

        renderWithSprite(
            <Controls isPlaying={false} togglePlay={togglePlay} bpm={120} setBpm={setBpm} zoom={1} setZoom={setZoom} />
        );

        const zoomToggle = screen.getByRole('button', { name: /toggle zoom/i });
        fireEvent.click(zoomToggle);

        expect(setZoom).not.toHaveBeenCalled();
        vi.advanceTimersByTime(210);
        expect(setZoom).toHaveBeenCalled();
    });

    it('should apply BPM decrease immediately per click', () => {
        const togglePlay = vi.fn();
        const setBpm = vi.fn();

        renderWithSprite(
            <Controls isPlaying={false} togglePlay={togglePlay} bpm={120} setBpm={setBpm} />
        );

        const decButton = screen.getByTitle('Decrease BPM [-]');
        fireEvent.click(decButton);
        fireEvent.click(decButton);

        expect(setBpm).toHaveBeenCalledTimes(2);
        expect(setBpm).toHaveBeenNthCalledWith(1, 119);
        expect(setBpm).toHaveBeenNthCalledWith(2, 119);
    });

    it('should apply BPM increase immediately', () => {
        const togglePlay = vi.fn();
        const setBpm = vi.fn();

        renderWithSprite(
            <Controls isPlaying={false} togglePlay={togglePlay} bpm={120} setBpm={setBpm} />
        );

        const incButton = screen.getByTitle('Increase BPM [+]');
        fireEvent.click(incButton);
        fireEvent.click(incButton);

        expect(setBpm).toHaveBeenCalledTimes(2);
        expect(setBpm).toHaveBeenNthCalledWith(1, 121);
        expect(setBpm).toHaveBeenNthCalledWith(2, 121);
    });

    it('should debounce rapid zoom clicks', () => {
        const togglePlay = vi.fn();
        const setBpm = vi.fn();
        const setZoom = vi.fn();

        renderWithSprite(
            <Controls isPlaying={false} togglePlay={togglePlay} bpm={120} setBpm={setBpm} zoom={1} setZoom={setZoom} />
        );

        const zoomToggle = screen.getByRole('button', { name: /toggle zoom/i });
        fireEvent.click(zoomToggle);
        fireEvent.click(zoomToggle);

        expect(setZoom).toHaveBeenCalledTimes(0);
        vi.advanceTimersByTime(210);
        expect(setZoom).toHaveBeenCalledTimes(1);
    });

    it('should debounce rapid auto-scroll clicks', () => {
        const togglePlay = vi.fn();
        const setBpm = vi.fn();
        const setAutoScroll = vi.fn();

        renderWithSprite(
            <Controls isPlaying={true} togglePlay={togglePlay} bpm={120} setBpm={setBpm} autoScroll={true} setAutoScroll={setAutoScroll} canScroll={true} zoom={1} setZoom={vi.fn()} />
        );

        const toggle = screen.getByRole('button', { name: /toggle auto-scroll/i });
        fireEvent.click(toggle);
        fireEvent.click(toggle);

        expect(setAutoScroll).toHaveBeenCalledTimes(0);
        vi.advanceTimersByTime(210);
        expect(setAutoScroll).toHaveBeenCalledTimes(1);
        const autoScrollUpdater = setAutoScroll.mock.calls[0][0];
        expect(typeof autoScrollUpdater).toBe('function');
        expect(autoScrollUpdater(true)).toBe(false);
    });
});
