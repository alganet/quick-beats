// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const RESCALED = { rescaled: true };
vi.mock('../utils/grooveConvert', () => ({
    rescaleOffsets: vi.fn(() => RESCALED),
}));
vi.mock('../data/humanizeStyle', () => ({
    HUMANIZE_STYLE: { timing: 0.5, velocity: 0.5 },
}));

import { rescaleOffsets } from '../utils/grooveConvert';
import { useHumanizeLifecycle } from './useHumanizeLifecycle';

const SIG_44 = { name: '4/4', stepsPerBeat: 4 };
const SIG_34 = { name: '3/4', stepsPerBeat: 4 };
const GRID = [[true, false], [false, true]];
const LAYER = { id: 'layer' };

function makeHumanize(overrides = {}) {
    return {
        phase: 'idle',
        compute: vi.fn(() => Promise.resolve(LAYER)),
        reset: vi.fn(),
        warmup: vi.fn(),
        modelPhase: 'ready',
        modelProgress: 0,
        computeBackend: 'wasm',
        ...overrides,
    };
}

function makeProps(overrides = {}) {
    return {
        grid: GRID,
        bpmInput: 120,
        timeSignature: SIG_44,
        isSetup: true,
        assetsReady: true,
        setPerfLayer: vi.fn(),
        setHumanizeEnabled: vi.fn(),
        setHumanizeOptions: vi.fn(),
        humanize: makeHumanize(),
        ...overrides,
    };
}

// Flush the compute().then() chain (two microtask hops).
async function flush() {
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
}

describe('useHumanizeLifecycle', () => {
    beforeEach(() => {
        rescaleOffsets.mockClear();
    });

    describe('humanizeSupported / status derivation', () => {
        it('reports unavailable for a non-16th-note signature', () => {
            const props = makeProps({ timeSignature: { name: '6/8', stepsPerBeat: 2 } });
            const { result } = renderHook((p) => useHumanizeLifecycle(p), { initialProps: props });
            expect(result.current.humanizeStatus).toBe('unavailable');
            expect(result.current.humanizeActive).toBe(false);
        });

        it('reports loading while the model is not ready', () => {
            const props = makeProps({ humanize: makeHumanize({ modelPhase: 'loading' }) });
            const { result } = renderHook((p) => useHumanizeLifecycle(p), { initialProps: props });
            expect(result.current.humanizeStatus).toBe('loading');
        });

        it('reports error when the model download failed', () => {
            const props = makeProps({ humanize: makeHumanize({ modelPhase: 'error' }) });
            const { result } = renderHook((p) => useHumanizeLifecycle(p), { initialProps: props });
            expect(result.current.humanizeStatus).toBe('error');
        });

        it('reports off when ready but not toggled on', () => {
            const { result } = renderHook((p) => useHumanizeLifecycle(p), { initialProps: makeProps() });
            expect(result.current.humanizeStatus).toBe('off');
        });

        it('reports error when a compute failed', () => {
            const props = makeProps({ humanize: makeHumanize({ phase: 'error' }) });
            const { result } = renderHook((p) => useHumanizeLifecycle(p), { initialProps: props });
            expect(result.current.humanizeStatus).toBe('error');
        });
    });

    describe('warmup gating', () => {
        it('warms up the model when set up + assets ready + supported', () => {
            const humanize = makeHumanize();
            renderHook((p) => useHumanizeLifecycle(p), { initialProps: makeProps({ humanize }) });
            expect(humanize.warmup).toHaveBeenCalled();
        });

        it('does not warm up before setup', () => {
            const humanize = makeHumanize();
            renderHook((p) => useHumanizeLifecycle(p), { initialProps: makeProps({ humanize, isSetup: false }) });
            expect(humanize.warmup).not.toHaveBeenCalled();
        });

        it('does not warm up for an unsupported signature', () => {
            const humanize = makeHumanize();
            renderHook((p) => useHumanizeLifecycle(p), {
                initialProps: makeProps({ humanize, timeSignature: { name: '6/8', stepsPerBeat: 2 } }),
            });
            expect(humanize.warmup).not.toHaveBeenCalled();
        });
    });

    describe('humanizeAction toggle matrix', () => {
        it('off -> on computes and enables the engine', async () => {
            const props = makeProps();
            const { result } = renderHook((p) => useHumanizeLifecycle(p), { initialProps: props });

            act(() => { result.current.humanizeAction(); });
            expect(props.humanize.compute).toHaveBeenCalledWith(GRID, 120, expect.any(Function));
            await flush();

            expect(props.setHumanizeEnabled).toHaveBeenCalledWith(true);
            expect(result.current.humanizeActive).toBe(true);
            expect(result.current.humanizeStatus).toBe('on');
        });

        it('on -> off disables the engine but keeps the remembered layer (no recompute)', async () => {
            const props = makeProps();
            const { result } = renderHook((p) => useHumanizeLifecycle(p), { initialProps: props });

            act(() => { result.current.humanizeAction(); }); // on
            await flush();
            expect(props.humanize.compute).toHaveBeenCalledTimes(1);

            act(() => { result.current.humanizeAction(); }); // off
            expect(result.current.humanizeActive).toBe(false);

            act(() => { result.current.humanizeAction(); }); // on again, same grid
            expect(props.humanize.compute).toHaveBeenCalledTimes(1); // reused, not recomputed
            expect(result.current.humanizeActive).toBe(true);
        });

        it('model error -> retries the download', () => {
            const humanize = makeHumanize({ modelPhase: 'error' });
            const { result } = renderHook((p) => useHumanizeLifecycle(p), { initialProps: makeProps({ humanize }) });
            humanize.warmup.mockClear();

            act(() => { result.current.humanizeAction(); });
            expect(humanize.warmup).toHaveBeenCalledTimes(1);
        });

        it('compute error -> retries the compute', () => {
            const humanize = makeHumanize({ phase: 'error' });
            const { result } = renderHook((p) => useHumanizeLifecycle(p), { initialProps: makeProps({ humanize }) });

            act(() => { result.current.humanizeAction(); });
            expect(humanize.compute).toHaveBeenCalledWith(GRID, 120, expect.any(Function));
        });

        it('ignores clicks while the model is still loading', () => {
            const humanize = makeHumanize({ modelPhase: 'loading' });
            const { result } = renderHook((p) => useHumanizeLifecycle(p), { initialProps: makeProps({ humanize }) });

            act(() => { result.current.humanizeAction(); });
            expect(humanize.compute).not.toHaveBeenCalled();
            expect(result.current.humanizeActive).toBe(false);
        });
    });

    describe('idle re-humanize', () => {
        beforeEach(() => { vi.useFakeTimers(); });
        afterEach(() => { vi.runOnlyPendingTimers(); vi.useRealTimers(); });

        async function flushFake() {
            await act(async () => { await Promise.resolve(); await Promise.resolve(); });
        }

        it.each([
            ['wasm', 1200],
            ['js', 5000],
        ])('re-humanizes after %s idle threshold (%dms)', async (backend, idleMs) => {
            const props = makeProps({ humanize: makeHumanize({ computeBackend: backend }) });
            const { result, rerender } = renderHook((p) => useHumanizeLifecycle(p), { initialProps: props });

            act(() => { result.current.humanizeAction(); }); // on -> compute #1
            await flushFake();
            expect(props.humanize.compute).toHaveBeenCalledTimes(1);

            // Edit the grid (new reference) -> pending, idle timer armed.
            const GRID2 = [[true, true], [false, false]];
            rerender({ ...props, grid: GRID2 });

            act(() => { vi.advanceTimersByTime(idleMs - 1); });
            expect(props.humanize.compute).toHaveBeenCalledTimes(1);

            act(() => { vi.advanceTimersByTime(1); });
            await flushFake();
            expect(props.humanize.compute).toHaveBeenCalledTimes(2);
            expect(props.humanize.compute).toHaveBeenLastCalledWith(GRID2, 120, expect.any(Function));
        });
    });

    describe('signature change', () => {
        it('resets humanization and clears the engine layer', async () => {
            const props = makeProps();
            const { result, rerender } = renderHook((p) => useHumanizeLifecycle(p), { initialProps: props });

            act(() => { result.current.humanizeAction(); }); // on
            await flush();
            expect(result.current.humanizeActive).toBe(true);

            rerender({ ...props, timeSignature: SIG_34 });
            expect(props.setPerfLayer).toHaveBeenCalledWith(null);
            expect(props.humanize.reset).toHaveBeenCalled();
            expect(result.current.humanizeActive).toBe(false);
        });
    });

    describe('bpm rescale', () => {
        it('rescales microtiming on bpm change without recomputing', async () => {
            const props = makeProps();
            const { result, rerender } = renderHook((p) => useHumanizeLifecycle(p), { initialProps: props });

            act(() => { result.current.humanizeAction(); }); // on, layer applied at 120
            await flush();
            expect(props.humanize.compute).toHaveBeenCalledTimes(1);
            props.setPerfLayer.mockClear();

            rerender({ ...props, bpmInput: 140 });

            expect(rescaleOffsets).toHaveBeenCalledWith(LAYER, 120, 140);
            expect(props.setPerfLayer).toHaveBeenCalledWith(RESCALED);
            expect(props.humanize.compute).toHaveBeenCalledTimes(1); // no recompute
        });

        it('rescales a layer that lands after the tempo already moved', async () => {
            // The genuine race: offsets come back in seconds for the bpm the
            // compute started at. Drag the tempo slider while the worker runs and
            // an unrescaled layer puts every hit at the wrong moment.
            let resolveCompute;
            const humanize = makeHumanize({
                compute: vi.fn(() => new Promise((resolve) => { resolveCompute = resolve; })),
            });
            const props = makeProps({ humanize });
            const { result, rerender } = renderHook((p) => useHumanizeLifecycle(p), { initialProps: props });

            act(() => { result.current.humanizeAction(); }); // starts at 120
            rerender({ ...props, bpmInput: 140 }); // ...and the user moves the slider
            await act(async () => { resolveCompute(LAYER); });

            expect(rescaleOffsets).toHaveBeenCalledWith(LAYER, 120, 140);
            expect(props.setPerfLayer).toHaveBeenCalledWith(RESCALED);
        });
    });

    describe('streaming partials', () => {
        // The whole reason compute takes an onPartial callback: a multi-bar beat
        // humanizes bar by bar instead of sitting still until the last window
        // lands. Every other test passes expect.any(Function) and never calls it.
        const partialOf = (props) => props.humanize.compute.mock.calls[0][2];

        it('applies each partial to the engine as it streams in', async () => {
            const props = makeProps();
            const { result } = renderHook((p) => useHumanizeLifecycle(p), { initialProps: props });

            act(() => { result.current.humanizeAction(); });
            props.setPerfLayer.mockClear();

            const onPartial = partialOf(props);
            act(() => { onPartial({ id: 'bar-1' }); });
            expect(props.setPerfLayer).toHaveBeenLastCalledWith({ id: 'bar-1' });

            act(() => { onPartial({ id: 'bar-2' }); });
            expect(props.setPerfLayer).toHaveBeenLastCalledWith({ id: 'bar-2' });
            expect(props.setPerfLayer).toHaveBeenCalledTimes(2);
        });

        it('tints the pads from the streamed partial, not only the final layer', async () => {
            const props = makeProps();
            const { result } = renderHook((p) => useHumanizeLifecycle(p), { initialProps: props });

            act(() => { result.current.humanizeAction(); });
            act(() => { partialOf(props)({ id: 'bar-1' }); });

            expect(result.current.humanizedLayer).toEqual({ id: 'bar-1' });

            await flush();
            expect(result.current.humanizedLayer).toEqual(LAYER);
        });

        it('ignores a null partial', () => {
            const props = makeProps();
            const { result } = renderHook((p) => useHumanizeLifecycle(p), { initialProps: props });

            act(() => { result.current.humanizeAction(); });
            props.setPerfLayer.mockClear();

            act(() => { partialOf(props)(null); });

            expect(props.setPerfLayer).not.toHaveBeenCalled();
        });
    });

    describe('humanizedLayer', () => {
        it('is null before anything has been humanized', () => {
            const { result } = renderHook((p) => useHumanizeLifecycle(p), { initialProps: makeProps() });
            expect(result.current.humanizedLayer).toBeNull();
        });

        it('holds the applied layer once humanize lands', async () => {
            const props = makeProps();
            const { result } = renderHook((p) => useHumanizeLifecycle(p), { initialProps: props });

            act(() => { result.current.humanizeAction(); });
            await flush();

            expect(result.current.humanizedLayer).toEqual(LAYER);
        });

        it('is cleared when the time signature changes', async () => {
            // A layer computed for 4/4 describes steps that no longer exist in
            // 3/4, so the reset has to drop the pad tint too — not just the
            // engine layer.
            const props = makeProps();
            const { result, rerender } = renderHook((p) => useHumanizeLifecycle(p), { initialProps: props });

            act(() => { result.current.humanizeAction(); });
            await flush();
            expect(result.current.humanizedLayer).toEqual(LAYER);

            rerender({ ...props, timeSignature: SIG_34 });

            expect(result.current.humanizedLayer).toBeNull();
        });
    });

    it('applies the humanize style options to the engine once', () => {
        const props = makeProps();
        renderHook((p) => useHumanizeLifecycle(p), { initialProps: props });
        expect(props.setHumanizeOptions).toHaveBeenCalledWith({ timing: 0.5, velocity: 0.5 });
    });
});
