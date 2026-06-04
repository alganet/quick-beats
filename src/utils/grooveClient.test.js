// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { computeHumanization, warmupWeights, __resetGrooveClient } from './grooveClient';

// Minimal Worker stub: echoes back a computed perf (or an error) per message id,
// and answers a { type: 'warmup' } with a progress tick then 'ready'.
class FakeWorker {
    constructor() {
        this.onmessage = null;
        this.onerror = null;
        FakeWorker.instances.push(this);
    }
    postMessage(msg) {
        FakeWorker.lastMessage = msg;
        if (msg.type === 'warmup') {
            queueMicrotask(() => {
                if (!this.onmessage) return;
                if (FakeWorker.warmupFails) {
                    this.onmessage({ data: { type: 'error', error: 'warmup failed' } });
                    return;
                }
                this.onmessage({ data: { type: 'progress', progress: 0.5 } });
                this.onmessage({ data: { type: 'ready' } });
            });
            return;
        }
        const { id, grid } = msg;
        queueMicrotask(() => {
            if (!this.onmessage) return;
            if (grid === 'BOOM') this.onmessage({ data: { id, error: 'worker failed' } });
            else this.onmessage({ data: { id, perf: [[{ vel: 0.5, offsetSec: 0 }]] } });
        });
    }
    terminate() {}
}
FakeWorker.instances = [];
FakeWorker.warmupFails = false;

describe('grooveClient', () => {
    beforeEach(() => {
        FakeWorker.instances = [];
        FakeWorker.warmupFails = false;
        vi.stubGlobal('Worker', FakeWorker);
    });
    afterEach(() => {
        __resetGrooveClient();
        vi.unstubAllGlobals();
    });

    it('spawns one worker lazily and reuses it', async () => {
        await computeHumanization([[true]], 120);
        await computeHumanization([[true]], 120);
        expect(FakeWorker.instances).toHaveLength(1);
    });

    it('resolves with the perf layer from the worker', async () => {
        const perf = await computeHumanization([[true]], 120);
        expect(perf).toEqual([[{ vel: 0.5, offsetSec: 0 }]]);
    });

    it('forwards grid + bpm to the worker', async () => {
        await computeHumanization([[true]], 90);
        expect(FakeWorker.lastMessage.grid).toEqual([[true]]);
        expect(FakeWorker.lastMessage.bpm).toBe(90);
    });

    it('rejects when the worker reports an error', async () => {
        await expect(computeHumanization('BOOM', 120)).rejects.toThrow('worker failed');
    });

    it('warmupWeights reports progress and resolves, reusing the one worker for compute', async () => {
        const onProgress = vi.fn();
        await warmupWeights(onProgress);
        expect(onProgress).toHaveBeenCalledWith(0.5);
        await computeHumanization([[true]], 120);
        expect(FakeWorker.instances).toHaveLength(1);
        expect(FakeWorker.instances[0].constructor).toBe(FakeWorker);
    });

    it('warmupWeights dedupes: a second call returns the same promise', async () => {
        const p1 = warmupWeights();
        const p2 = warmupWeights();
        expect(p1).toBe(p2);
        await p1;
        expect(FakeWorker.instances).toHaveLength(1);
    });

    it('warmupWeights rejects when the worker reports an error', async () => {
        FakeWorker.warmupFails = true;
        await expect(warmupWeights()).rejects.toThrow('warmup failed');
    });

    it('routes concurrent requests to the right promise by id', async () => {
        const [a, b] = await Promise.all([
            computeHumanization([[true]], 120),
            computeHumanization([[false]], 90),
        ]);
        expect(a).toEqual([[{ vel: 0.5, offsetSec: 0 }]]);
        expect(b).toEqual([[{ vel: 0.5, offsetSec: 0 }]]);
    });
});
