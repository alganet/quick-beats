// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAudio } from './useAudio';
import * as Tone from 'tone';
import { KITS } from '../data/kit';

// Mock Tone.js
vi.mock('tone', () => {
    const transportMock = {
        start: vi.fn(),
        stop: vi.fn(),
        scheduleRepeat: vi.fn(),
        cancel: vi.fn(),
        bpm: { value: 120 },
        state: 'stopped'
    };
    
    // Update state when methods are called
    transportMock.start.mockImplementation(() => { transportMock.state = 'started'; });
    transportMock.stop.mockImplementation(() => { transportMock.state = 'stopped'; });

    return {
        Players: vi.fn(),
        Loop: vi.fn((cb) => ({ start: vi.fn(), dispose: vi.fn(), callback: cb })),
        Transport: transportMock,
        getTransport: vi.fn().mockReturnValue(transportMock),
        getDraw: vi.fn().mockReturnValue({
            schedule: vi.fn((cb) => cb()) // Execute callback immediately for testing
        }),
        Draw: {
            schedule: vi.fn((cb) => cb()) 
        },
        start: vi.fn().mockResolvedValue(),
        loaded: vi.fn().mockResolvedValue(),
        now: vi.fn().mockReturnValue(0),
        Time: (val) => ({ toSeconds: () => parseFloat(val) })
    };
});

describe('useAudio', () => {
    let mockPlayersInstance;
    let mockLoopInstance;

    beforeEach(() => {
        // Reset mocks
        vi.clearAllMocks();
        
        // Reset Transport state
        if (Tone.Transport) {
            Tone.Transport.state = 'stopped';
        }

        // Setup Players mock instance
        mockPlayersInstance = {
            toDestination: vi.fn().mockReturnThis(),
            dispose: vi.fn(),
            player: vi.fn().mockReturnValue({
                start: vi.fn().mockReturnThis(),
                stop: vi.fn().mockReturnThis()
            }),
            has: vi.fn().mockReturnValue(true)
        };
        
        // Mock the constructor behavior
        Tone.Players.mockImplementation(function() { return mockPlayersInstance; });

        // Setup Loop mock instance
        mockLoopInstance = {
            start: vi.fn().mockReturnThis(),
            stop: vi.fn().mockReturnThis(),
            dispose: vi.fn()
        };
        Tone.Loop.mockImplementation(function(cb) {
            mockLoopInstance.callback = cb;
            return mockLoopInstance;
        });
    });

    it('lazy-loads default kit on demand', async () => {
        const { result } = renderHook(() => useAudio());

        // No automatic load on mount
        expect(Tone.Players).not.toHaveBeenCalled();

        // Explicitly load kit (simulates user-driven load)
        await act(async () => { await result.current.loadKit('black-pearl'); });

        expect(Tone.Players).toHaveBeenCalled();
        expect(Tone.loaded).toHaveBeenCalled();
        expect(result.current.isLoaded).toBe(true);
    });

    it('toggles playback', async () => {
        const { result } = renderHook(() => useAudio());

        // Ensure kit is loaded before attempting to play
        await act(async () => { await result.current.loadKit('black-pearl'); });

        // Start
        await act(async () => {
             result.current.togglePlay();
        });

        expect(Tone.start).toHaveBeenCalled();
        expect(Tone.Transport.start).toHaveBeenCalled();
        expect(result.current.isPlaying).toBe(true);

        // Move playhead to a non-zero step and ensure stopping preserves it
        act(() => {
            result.current.setStep(4);
        });
        expect(result.current.currentStep).toBe(4);

        // Stop (pause) — should NOT reset currentStep
        act(() => {
            result.current.togglePlay();
        });

        expect(Tone.Transport.stop).toHaveBeenCalled();
        expect(result.current.isPlaying).toBe(false);
        expect(result.current.currentStep).toBe(4);

        // Resume should set isPlaying true and keep the same step
        await act(async () => {
            await result.current.togglePlay();
        });
        expect(result.current.isPlaying).toBe(true);
    });

    it('requests wake lock when playback starts (if supported)', async () => {
        const sentinel = { release: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn() };
        Object.defineProperty(navigator, 'wakeLock', { value: { request: vi.fn().mockResolvedValue(sentinel) }, configurable: true });

        const { result } = renderHook(() => useAudio());
        await act(async () => { await result.current.loadKit('black-pearl'); });

        await act(async () => { await result.current.togglePlay(); });
        expect(navigator.wakeLock.request).toHaveBeenCalledWith('screen');
    });

    it('releases wake lock when playback stops', async () => {
        const sentinel = { release: vi.fn().mockResolvedValue(), addEventListener: vi.fn(), removeEventListener: vi.fn() };
        Object.defineProperty(navigator, 'wakeLock', { value: { request: vi.fn().mockResolvedValue(sentinel) }, configurable: true });

        const { result } = renderHook(() => useAudio());
        await act(async () => { await result.current.loadKit('black-pearl'); });

        await act(async () => { await result.current.togglePlay(); });
        act(() => { result.current.togglePlay(); });

        expect(sentinel.release).toHaveBeenCalled();
    });

    it('releases wake lock on unmount', async () => {
        const sentinel = { release: vi.fn().mockResolvedValue(), addEventListener: vi.fn(), removeEventListener: vi.fn() };
        Object.defineProperty(navigator, 'wakeLock', { value: { request: vi.fn().mockResolvedValue(sentinel) }, configurable: true });

        const { result, unmount } = renderHook(() => useAudio());
        await act(async () => { await result.current.loadKit('black-pearl'); });
        await act(async () => { await result.current.togglePlay(); });

        unmount();
        expect(sentinel.release).toHaveBeenCalled();
    });

    it('updates BPM', () => {
        const { result } = renderHook(() => useAudio());
        
        act(() => {
            result.current.setBpm(140);
        });

        expect(Tone.Transport.bpm.value).toBe(140);
    });
    
    it('updates grid ref', () => {
        const { result } = renderHook(() => useAudio());
        const newGrid = [[true, false], [false, true]];
        
        act(() => {
            result.current.updateGrid(newGrid);
        });
        
        // Unfortunately usage of gridRef is internal to step logic, 
        // we might not observe it directly unless we run the sequencer loop
    });


    it('sets step manually', () => {
        const { result } = renderHook(() => useAudio());
        
        act(() => {
            result.current.setStep(5);
        });
        
        expect(result.current.currentStep).toBe(5);
    });

    it('plays a single note', async () => {
        const { result } = renderHook(() => useAudio());
        await act(async () => { await result.current.loadKit('black-pearl'); });
        
        act(() => {
            result.current.playNote('Kick');
        });
        
        expect(mockPlayersInstance.player).toHaveBeenCalledWith('Kick');
        expect(mockPlayersInstance.player().start).toHaveBeenCalled();
    });

    it('executes loop logic', async () => {
        const { result } = renderHook(() => useAudio());
        await act(async () => { await result.current.loadKit('black-pearl'); });
        
        // Ensure grid is set
        // Mock default kit has 7 instruments. We provide grid for first instrument (Kick) 
        // and empty for others implicitly or loop handles undefined rows gracefully?
        // useAudio code: if (currentGrid[rowIndex] && currentGrid[rowIndex][step])
        const grid = [[true, false]]; // Row 0: Kick. 2 steps.
        
        act(() => {
            result.current.updateGrid(grid);
            // Also need to reset step to 0 ? It defaults to 0.
        });
        
        // Find the Loop callback
        expect(Tone.Loop).toHaveBeenCalled();
        // The callback is the first argument
        const loopCallback = Tone.Loop.mock.calls[0][0];

        // Execute loop callback for step 0
        act(() => {
             loopCallback(10); // time = 10
        });
        
        // Check if Kick started
        // Note: players.has('Kick') is mocked to true
        // INSTRUMENTS[0] is 'Kick'
        expect(mockPlayersInstance.player).toHaveBeenCalledWith('Kick');
        expect(mockPlayersInstance.player().start).toHaveBeenCalledWith(10, 0);
        expect(mockPlayersInstance.player().stop).not.toHaveBeenCalled();
        
        // Check step update
        expect(result.current.currentStep).toBe(0);
        
        // Execute again for step 1 (empty)
        // mock has() returns true always, but grid at step 1 is false.
        mockPlayersInstance.player.mockClear();
        
        act(() => {
             loopCallback(11);
        });
        
        expect(result.current.currentStep).toBe(1);
        expect(mockPlayersInstance.player).not.toHaveBeenCalled();
    });

    it('ignores stale scheduled UI updates after manual seek', async () => {
        const scheduledCallbacks = [];
        Tone.getDraw.mockReturnValue({
            schedule: vi.fn((cb) => {
                scheduledCallbacks.push(cb);
            })
        });

        const { result } = renderHook(() => useAudio());
        await act(async () => { await result.current.loadKit('black-pearl'); });

        act(() => {
            result.current.updateGrid([[true, false]]);
        });

        const loopCallback = Tone.Loop.mock.calls[0][0];

        act(() => {
            loopCallback(10);
        });

        act(() => {
            result.current.setStep(7);
        });

        expect(result.current.currentStep).toBe(7);

        act(() => {
            scheduledCallbacks[0]();
        });

        expect(result.current.currentStep).toBe(7);
    });

    it('cleans up on unmount', async () => {
        const { result, unmount } = renderHook(() => useAudio());
        await act(async () => { await result.current.loadKit('black-pearl'); });

        unmount();

        expect(mockPlayersInstance.dispose).toHaveBeenCalled();
    });
});
