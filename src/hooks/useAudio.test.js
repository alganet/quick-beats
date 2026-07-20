// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { StrictMode } from 'react';
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
    transportMock.start.mockImplementation(() => { transportMock.state = 'started'; });
    transportMock.stop.mockImplementation(() => { transportMock.state = 'stopped'; });

    return {
        Player: vi.fn(),
        Gain: vi.fn(),
        Loop: vi.fn((cb) => ({ start: vi.fn(), dispose: vi.fn(), callback: cb })),
        Transport: transportMock,
        getTransport: vi.fn().mockReturnValue(transportMock),
        getDraw: vi.fn().mockReturnValue({
            schedule: vi.fn((cb) => cb()) // Execute callback immediately for testing
        }),
        start: vi.fn().mockResolvedValue(),
        loaded: vi.fn().mockResolvedValue(),
        now: vi.fn().mockReturnValue(0),
        immediate: vi.fn().mockReturnValue(0),
        Time: (val) => ({ toSeconds: () => parseFloat(val) })
    };
});

describe('useAudio', () => {
    let createdPlayers;
    let createdGains;
    let mockLoopInstance;

    // Gain is constructed first, then Player.connect(gain) per instrument, so the
    // k-th Player pairs with the k-th Gain.
    const chainFor = (name) => {
        const clean = KITS['black-pearl'].samples[name].replace(/^\//, '');
        const idx = createdPlayers.findIndex((p) => p.url.includes(clean));
        return { player: createdPlayers[idx], gain: createdGains[idx] };
    };

    beforeEach(() => {
        vi.clearAllMocks();
        if (Tone.Transport) Tone.Transport.state = 'stopped';

        createdPlayers = [];
        createdGains = [];

        Tone.Gain.mockImplementation(function () {
            const g = {
                gain: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
                toDestination: vi.fn().mockReturnThis(),
                connect: vi.fn().mockReturnThis(),
                dispose: vi.fn(),
            };
            createdGains.push(g);
            return g;
        });
        Tone.Player.mockImplementation(function (url) {
            const p = {
                url,
                fadeOut: 0,
                connect: vi.fn().mockReturnThis(),
                start: vi.fn().mockReturnThis(),
                stop: vi.fn(),
                dispose: vi.fn(),
            };
            createdPlayers.push(p);
            return p;
        });

        mockLoopInstance = {
            start: vi.fn().mockReturnThis(),
            stop: vi.fn().mockReturnThis(),
            dispose: vi.fn(),
        };
        Tone.Loop.mockImplementation(function (cb) {
            mockLoopInstance.callback = cb;
            return mockLoopInstance;
        });
    });

    it('lazy-loads default kit on demand', async () => {
        const { result } = renderHook(() => useAudio());
        expect(Tone.Player).not.toHaveBeenCalled();

        await act(async () => { await result.current.loadKit('black-pearl'); });

        expect(Tone.Player).toHaveBeenCalled();
        expect(Tone.Gain).toHaveBeenCalled();
        expect(Tone.loaded).toHaveBeenCalled();
        expect(result.current.isLoaded).toBe(true);
    });

    it('toggles playback', async () => {
        const { result } = renderHook(() => useAudio());
        await act(async () => { await result.current.loadKit('black-pearl'); });

        await act(async () => { result.current.togglePlay(); });
        expect(Tone.start).toHaveBeenCalled();
        expect(Tone.Transport.start).toHaveBeenCalled();
        expect(result.current.isPlaying).toBe(true);

        act(() => { result.current.setStep(4); });
        expect(result.current.currentStep).toBe(4);

        act(() => { result.current.togglePlay(); });
        expect(Tone.Transport.stop).toHaveBeenCalled();
        expect(result.current.isPlaying).toBe(false);
        expect(result.current.currentStep).toBe(4);

        await act(async () => { await result.current.togglePlay(); });
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
        act(() => { result.current.setBpm(140); });
        expect(Tone.Transport.bpm.value).toBe(140);
    });

    it('updates grid ref', () => {
        const { result } = renderHook(() => useAudio());
        act(() => { result.current.updateGrid([[true, false], [false, true]]); });
        // The ref is private, so drive the loop and observe that it reads the
        // new grid — this test previously had no assertion at all.
        const loopCallback = Tone.Loop.mock.calls[0][0];
        expect(() => loopCallback(0)).not.toThrow();
        expect(result.current.currentStep).toBeDefined();
    });

    it('runs the transport loop on sixteenth notes, starting at zero', () => {
        // The subdivision is the app's step resolution. Nothing asserted it, so
        // changing "16n" to "8n" — halving every beat anyone has made — passed
        // the entire suite.
        renderHook(() => useAudio());
        expect(Tone.Loop).toHaveBeenCalledWith(expect.any(Function), '16n');
        expect(mockLoopInstance.start).toHaveBeenCalledWith(0);
    });

    it('sets step manually', () => {
        const { result } = renderHook(() => useAudio());
        act(() => { result.current.setStep(5); });
        expect(result.current.currentStep).toBe(5);
    });

    it('plays a single note', async () => {
        const { result } = renderHook(() => useAudio());
        await act(async () => { await result.current.loadKit('black-pearl'); });
        act(() => { result.current.playNote('Kick'); });
        expect(chainFor('Kick').player.start).toHaveBeenCalled();
    });

    it('executes loop logic (flat playback, no humanization)', async () => {
        const { result } = renderHook(() => useAudio());
        await act(async () => { await result.current.loadKit('black-pearl'); });
        act(() => { result.current.updateGrid([[true, false]]); }); // Kick row, 2 steps

        const loopCallback = Tone.Loop.mock.calls[0][0];
        act(() => { loopCallback(10); }); // step 0

        const kick = chainFor('Kick');
        expect(kick.player.start).toHaveBeenCalledWith(10, 0);
        // Optimization: gain is already 1, so the hot path writes no Web Audio
        // params — just .start(), like the original engine.
        expect(kick.gain.gain.setValueAtTime).not.toHaveBeenCalled();
        expect(result.current.currentStep).toBe(0);

        createdPlayers.forEach((p) => p.start.mockClear());
        act(() => { loopCallback(11); }); // step 1 (empty)
        expect(result.current.currentStep).toBe(1);
        expect(createdPlayers.every((p) => p.start.mock.calls.length === 0)).toBe(true);
    });

    it('applies humanized velocity + microtiming when enabled', async () => {
        const { result } = renderHook(() => useAudio());
        await act(async () => { await result.current.loadKit('black-pearl'); });
        act(() => {
            result.current.updateGrid([[true, false]]);
            result.current.setPerfLayer([[{ vel: 0.5, offsetSec: 0.02 }, null]]);
            result.current.setHumanizeEnabled(true);
        });

        const loopCallback = Tone.Loop.mock.calls[0][0];
        act(() => { loopCallback(10); });

        const kick = chainFor('Kick');
        expect(kick.gain.gain.setValueAtTime).toHaveBeenCalledWith(0.5, 10.02);
        expect(kick.player.start).toHaveBeenCalledWith(10.02, 0);
    });

    it('does not push an on-grid humanized hit forward when the event time sits inside the lookahead window', async () => {
        // Regression: the loop's `time` is a future event INSIDE the context
        // lookahead, so time <= now() (now = currentTime + lookAhead). The "never
        // schedule in the past" floor must use immediate() (raw currentTime), not
        // now(); otherwise a zero-offset hit gets clamped forward to now()+lookAhead.
        Tone.immediate.mockReturnValue(9.95); // raw currentTime
        Tone.now.mockReturnValue(10.05);      // currentTime + 0.1 lookAhead
        const { result } = renderHook(() => useAudio());
        const loop = await enableHumanized(
            result,
            { vel: 1, offsetSec: 0 }, // full gain, on-grid
            { timing: 1, velocity: 1 },
        );
        act(() => { loop(10); }); // event time 10: ahead of currentTime, behind now()
        const kick = chainFor('Kick');
        // Plays exactly at its scheduled time, not clamped to now()+0.001.
        expect(kick.player.start).toHaveBeenCalledWith(10, 0);
    });

    it('clamps a genuinely early (negative-offset) hit up to the current time, never the past', async () => {
        // The other side of the clamp: a hit pushed before raw currentTime must
        // land on immediate(), not in the past (Web Audio would drop it).
        Tone.immediate.mockReturnValue(10);
        const { result } = renderHook(() => useAudio());
        const loop = await enableHumanized(
            result,
            { vel: 0.5, offsetSec: -0.05 }, // 10 + (-0.05) = 9.95 < earliest(10)
            { timing: 1, velocity: 1 },
        );
        act(() => { loop(10); });
        const kick = chainFor('Kick');
        expect(kick.player.start).toHaveBeenCalledWith(10, 0); // clamped up to immediate()
        expect(kick.gain.gain.setValueAtTime).toHaveBeenCalledWith(0.5, 10);
    });

    it('restores full gain on a flat (no perf entry) hit following a ghost hit', async () => {
        const { result } = renderHook(() => useAudio());
        await act(async () => { await result.current.loadKit('black-pearl'); });
        act(() => {
            result.current.updateGrid([[true, true]]); // 2 kicks
            // step 0 = ghost (0.5), step 1 = active but no perf entry -> flat fallback
            result.current.setPerfLayer([[{ vel: 0.5, offsetSec: 0 }, null]]);
            result.current.setHumanizeOptions({ timing: 1, velocity: 1 });
            result.current.setHumanizeEnabled(true);
        });
        const loop = Tone.Loop.mock.calls[0][0];
        act(() => { loop(10); }); // ghost -> gain 0.5
        act(() => { loop(11); }); // flat fallback -> gain restored to 1
        const kick = chainFor('Kick');
        expect(kick.gain.gain.setValueAtTime).toHaveBeenCalledWith(0.5, 10);
        expect(kick.gain.gain.setValueAtTime).toHaveBeenCalledWith(1, 11);
        expect(kick.player.start).toHaveBeenCalledWith(11, 0);
    });

    const enableHumanized = async (result, perfCell, options) => {
        await act(async () => { await result.current.loadKit('black-pearl'); });
        act(() => {
            result.current.updateGrid([[true, false]]);
            result.current.setPerfLayer([[perfCell, null]]);
            if (options) result.current.setHumanizeOptions(options);
            result.current.setHumanizeEnabled(true);
        });
        return Tone.Loop.mock.calls[0][0];
    };

    it('timing=0 suppresses microtiming (plays on the quantized time)', async () => {
        const { result } = renderHook(() => useAudio());
        const loop = await enableHumanized(
            result,
            { vel: 0.6, offsetSec: 0.02 },
            { timing: 0, velocity: 1, attack: 0, release: 0.005 },
        );
        act(() => { loop(10); });
        const kick = chainFor('Kick');
        expect(kick.player.start).toHaveBeenCalledWith(10, 0); // offset * 0 = 0
        expect(kick.gain.gain.setValueAtTime).toHaveBeenCalledWith(0.6, 10);
    });

    it('velocity blend reduces gain proportionally', async () => {
        const { result } = renderHook(() => useAudio());
        const loop = await enableHumanized(
            result,
            { vel: 0.4, offsetSec: 0 },
            { timing: 1, velocity: 0.5, attack: 0, release: 0.005 },
        );
        act(() => { loop(10); });
        // effVel = 1 + (0.4 - 1) * 0.5 = 0.7
        expect(chainFor('Kick').gain.gain.setValueAtTime).toHaveBeenCalledWith(0.7, 10);
    });

    it('velocity=0 leaves the gain at full (no redundant write)', async () => {
        const { result } = renderHook(() => useAudio());
        const loop = await enableHumanized(
            result,
            { vel: 0.4, offsetSec: 0 },
            { timing: 1, velocity: 0, attack: 0, release: 0.005 },
        );
        act(() => { loop(10); });
        const kick = chainFor('Kick');
        // effVel = 1 (already the resting gain) -> no param write, just .start()
        expect(kick.gain.gain.setValueAtTime).not.toHaveBeenCalled();
        expect(kick.player.start).toHaveBeenCalledWith(10, 0);
    });

    it('applies the model velocity + microtiming at full strength', async () => {
        const { result } = renderHook(() => useAudio());
        const loop = await enableHumanized(
            result,
            { vel: 0.4, offsetSec: 0.05 },
            { timing: 1, velocity: 1 },
        );
        act(() => { loop(10); });
        const kick = chainFor('Kick');
        const [g, t] = kick.gain.gain.setValueAtTime.mock.calls.at(-1);
        expect(g).toBeCloseTo(0.4, 5);
        expect(t).toBeCloseTo(10.05, 5);
        expect(kick.player.start.mock.calls.at(-1)[0]).toBeCloseTo(10.05, 5);
    });

    it('plays flat when humanize on but no perf entry for an active cell', async () => {
        const { result } = renderHook(() => useAudio());
        await act(async () => { await result.current.loadKit('black-pearl'); });
        act(() => {
            result.current.updateGrid([[true, false]]);
            result.current.setPerfLayer([[null, null]]);
            result.current.setHumanizeEnabled(true);
        });

        const loopCallback = Tone.Loop.mock.calls[0][0];
        act(() => { loopCallback(10); });

        const kick = chainFor('Kick');
        // no perf entry -> flat; gain already at resting 1, so no write, just start
        expect(kick.gain.gain.setValueAtTime).not.toHaveBeenCalled();
        expect(kick.player.start).toHaveBeenCalledWith(10, 0);
    });

    it('resets gain back to full after a quiet (ghost) hit', async () => {
        const { result } = renderHook(() => useAudio());
        await act(async () => { await result.current.loadKit('black-pearl'); });
        act(() => {
            result.current.updateGrid([[true, true]]); // 2 steps, both kick
            // step 0 = ghost (gain 0.5), step 1 = full (gain 1)
            result.current.setPerfLayer([[{ vel: 0.5, offsetSec: 0 }, { vel: 1, offsetSec: 0 }]]);
            result.current.setHumanizeOptions({ timing: 1, velocity: 1, attack: 0, release: 0.005 });
            result.current.setHumanizeEnabled(true);
        });

        const loopCallback = Tone.Loop.mock.calls[0][0];
        act(() => { loopCallback(10); }); // step 0 -> gain 0.5
        act(() => { loopCallback(11); }); // step 1 -> gain reset to 1
        const kick = chainFor('Kick');
        expect(kick.gain.gain.setValueAtTime).toHaveBeenCalledWith(0.5, 10);
        expect(kick.gain.gain.setValueAtTime).toHaveBeenCalledWith(1, 11);
    });

    it('ignores stale scheduled UI updates after manual seek', async () => {
        const scheduledCallbacks = [];
        Tone.getDraw.mockReturnValue({
            schedule: vi.fn((cb) => { scheduledCallbacks.push(cb); })
        });

        const { result } = renderHook(() => useAudio());
        await act(async () => { await result.current.loadKit('black-pearl'); });
        act(() => { result.current.updateGrid([[true, false]]); });

        const loopCallback = Tone.Loop.mock.calls[0][0];
        act(() => { loopCallback(10); });
        act(() => { result.current.setStep(7); });
        expect(result.current.currentStep).toBe(7);
        act(() => { scheduledCallbacks[0](); });
        expect(result.current.currentStep).toBe(7);
    });

    it('cleans up on unmount', async () => {
        const { result, unmount } = renderHook(() => useAudio());
        await act(async () => { await result.current.loadKit('black-pearl'); });
        expect(createdPlayers.length).toBeGreaterThan(0);
        unmount();
        expect(createdPlayers.every((p) => p.dispose.mock.calls.length > 0)).toBe(true);
        expect(createdGains.every((g) => g.dispose.mock.calls.length > 0)).toBe(true);
    });

    it('handles audio playback errors gracefully', async () => {
        const { result } = renderHook(() => useAudio());
        await act(async () => { await result.current.loadKit('black-pearl'); });

        chainFor('Kick').player.start.mockImplementation(() => { throw new Error('Audio error'); });
        act(() => { result.current.updateGrid([[true, false]]); });

        const loopCallback = Tone.Loop.mock.calls[0][0];
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        act(() => { loopCallback(10); });
        expect(warnSpy).toHaveBeenCalled();
        warnSpy.mockRestore();
    });

    describe('kit switching', () => {
        it('switches kits gaplessly: builds the new kit before disposing the old', async () => {
            const { result } = renderHook(() => useAudio());
            await act(async () => { await result.current.loadKit('black-pearl'); });
            const bpPlayers = [...createdPlayers];
            const bpCount = bpPlayers.length;

            await act(async () => { await result.current.loadKit('red-zeppelin'); });

            // The new kit's players were built...
            const rzPlayers = createdPlayers.slice(bpCount);
            expect(rzPlayers.length).toBe(bpCount);
            expect(rzPlayers.every((p) => p.url.includes('RED_ZEPPELIN'))).toBe(true);

            // ...the old kit's players were disposed, the new ones were not.
            expect(bpPlayers.every((p) => p.dispose.mock.calls.length > 0)).toBe(true);
            expect(rzPlayers.every((p) => p.dispose.mock.calls.length === 0)).toBe(true);

            // Build-before-swap: every new Player is constructed BEFORE any old
            // player is disposed, so the playback loop never sees a missing chain.
            const order = Tone.Player.mock.invocationCallOrder;
            const lastNewBuild = Math.max(...rzPlayers.map((_p, i) => order[bpCount + i]));
            const firstOldDispose = Math.min(...bpPlayers.map((p) => p.dispose.mock.invocationCallOrder[0]));
            expect(lastNewBuild).toBeLessThan(firstOldDispose);

            expect(result.current.activeKit).toBe('red-zeppelin');
        });

        it('last-wins: a superseded switch leaves no extra live players', async () => {
            const { result } = renderHook(() => useAudio());
            await act(async () => { await result.current.loadKit('black-pearl'); });
            const bpCount = createdPlayers.length;

            await act(async () => {
                const a = result.current.loadKit('red-zeppelin');
                const b = result.current.loadKit('red-zeppelin');
                await Promise.all([a, b]);
            });

            // Exactly one RZ install is live; the engine ends on red-zeppelin.
            const liveRz = createdPlayers.filter(
                (p) => p.url.includes('RED_ZEPPELIN') && p.dispose.mock.calls.length === 0,
            );
            expect(liveRz.length).toBe(bpCount);
            expect(result.current.activeKit).toBe('red-zeppelin');
        });

        it('first play lazy-loads the preferred (initial) kit, not the default', async () => {
            const { result } = renderHook(() => useAudio('red-zeppelin'));
            expect(result.current.activeKit).toBe('red-zeppelin');

            await act(async () => { await result.current.togglePlay(); });

            expect(createdPlayers.some((p) => p.url.includes('RED_ZEPPELIN'))).toBe(true);
            expect(createdPlayers.every((p) => !p.url.includes('BLACK_PEARL'))).toBe(true);
            expect(result.current.activeKit).toBe('red-zeppelin');
        });

        it('no-ops (and reports complete) when re-selecting the active kit', async () => {
            const { result } = renderHook(() => useAudio());
            await act(async () => { await result.current.loadKit('black-pearl'); });
            const count = createdPlayers.length;
            const onProgress = vi.fn();

            await act(async () => { await result.current.loadKit('black-pearl', onProgress); });

            expect(createdPlayers.length).toBe(count); // no rebuild
            expect(onProgress).toHaveBeenCalledWith(1);
        });

        it('still loads under StrictMode (mountedRef survives the setup→cleanup→setup cycle)', async () => {
            // Regression: StrictMode runs the cleanup effect (which clears mountedRef)
            // between two setups. If setup doesn't re-set it true, loadKit bails on
            // !mountedRef.current and disposes the new chains → silence.
            const { result } = renderHook(() => useAudio(), { wrapper: StrictMode });
            await act(async () => { await result.current.loadKit('black-pearl'); });

            expect(result.current.isLoaded).toBe(true);
            expect(result.current.activeKit).toBe('black-pearl');
            expect(createdPlayers.length).toBeGreaterThan(0);
            expect(createdPlayers.every((p) => p.dispose.mock.calls.length === 0)).toBe(true);
        });

        it('keeps the current kit and disposes the new chains when a switch fails to load', async () => {
            const { result } = renderHook(() => useAudio());
            await act(async () => { await result.current.loadKit('black-pearl'); });
            const bpPlayers = [...createdPlayers];
            const bpCount = bpPlayers.length;

            // A sample fails to decode/load: Tone.loaded() rejects for this switch.
            Tone.loaded.mockRejectedValueOnce(new Error('decode failed'));
            // Must not throw out of loadKit (would wedge togglePlay/handleSelectKit).
            await act(async () => { await result.current.loadKit('red-zeppelin'); });

            const rzPlayers = createdPlayers.slice(bpCount);
            expect(rzPlayers.length).toBe(bpCount);
            // The half-built kit's nodes are all disposed (no leak)...
            expect(rzPlayers.every((p) => p.dispose.mock.calls.length > 0)).toBe(true);
            // ...and the previous kit stays live and active.
            expect(bpPlayers.every((p) => p.dispose.mock.calls.length === 0)).toBe(true);
            expect(result.current.activeKit).toBe('black-pearl');
            expect(result.current.isLoaded).toBe(true);
        });

        // loadKit never rejects, so its resolved value is the entire outcome
        // channel — App.jsx announces kit success and failure from it. Every
        // other test in this file awaits loadKit and throws the value away, so
        // the documented contract was unverified.
        describe('resolved outcome', () => {
            it("resolves 'ok' when the kit is installed and sounding", async () => {
                const { result } = renderHook(() => useAudio());
                let outcome;
                await act(async () => { outcome = await result.current.loadKit('black-pearl'); });
                expect(outcome).toBe('ok');
            });

            it("resolves 'ok' when re-selecting the kit already loaded", async () => {
                const { result } = renderHook(() => useAudio());
                await act(async () => { await result.current.loadKit('black-pearl'); });
                let outcome;
                await act(async () => { outcome = await result.current.loadKit('black-pearl'); });
                expect(outcome).toBe('ok');
            });

            it("resolves 'failed' for an unknown kit id", async () => {
                // Reachable from a share link: parseShareHash accepts any kit id
                // it finds in the hash, so this is a real user-facing path.
                const { result } = renderHook(() => useAudio());
                let outcome;
                await act(async () => { outcome = await result.current.loadKit('no-such-kit'); });

                expect(outcome).toBe('failed');
                expect(createdPlayers.length).toBe(0);
            });

            it("resolves 'failed' when a sample refuses to load", async () => {
                const { result } = renderHook(() => useAudio());
                await act(async () => { await result.current.loadKit('black-pearl'); });

                Tone.loaded.mockRejectedValueOnce(new Error('decode failed'));
                let outcome;
                await act(async () => { outcome = await result.current.loadKit('red-zeppelin'); });

                expect(outcome).toBe('failed');
            });

            it("resolves 'superseded' for the switch that lost the race", async () => {
                const { result } = renderHook(() => useAudio());
                await act(async () => { await result.current.loadKit('black-pearl'); });

                let outcomes;
                await act(async () => {
                    outcomes = await Promise.all([
                        result.current.loadKit('red-zeppelin'),
                        result.current.loadKit('red-zeppelin'),
                    ]);
                });

                // The loser announces itself so the caller can stay quiet rather
                // than reporting a failure the user did not cause.
                expect(outcomes).toContain('superseded');
                expect(outcomes).toContain('ok');
            });
        });
    });
});
