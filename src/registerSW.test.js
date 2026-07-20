// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { registerServiceWorker, UPDATE_CHECK_INTERVAL_MS } from './registerSW';

describe('registerServiceWorker', () => {
    let addEventListener;

    // Captured rather than left attached: every test drives the handler
    // directly, and a listener surviving into the next test would let one test's
    // registration answer another's visibilitychange.
    const visibilityHandler = () => {
        const call = addEventListener.mock.calls.find(([type]) => type === 'visibilitychange');
        return call?.[1];
    };

    const setVisibility = (state) => {
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
    };

    const makeContainer = (registration = { update: vi.fn(() => Promise.resolve()) }) => ({
        register: vi.fn(() => Promise.resolve(registration)),
        registration,
    });

    beforeEach(() => {
        addEventListener = vi.spyOn(document, 'addEventListener');
        setVisibility('visible');
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    describe('registration', () => {
        it('registers sw.js at BASE_URL and scopes it there', async () => {
            // The scope has to be the base: GitHub Pages cannot send a
            // Service-Worker-Allowed header, so a worker at /quick-beats/ can
            // only ever control /quick-beats/.
            const container = makeContainer();
            await registerServiceWorker({ base: '/quick-beats/', container });

            expect(container.register).toHaveBeenCalledWith('/quick-beats/sw.js', { scope: '/quick-beats/' });
        });

        it('registers at the root when the base is /', async () => {
            const container = makeContainer();
            await registerServiceWorker({ base: '/', container });

            expect(container.register).toHaveBeenCalledWith('/sw.js', { scope: '/' });
        });

        it('attaches no listener when the browser has no service worker support', async () => {
            await expect(registerServiceWorker({ base: '/', container: undefined })).resolves.toBeNull();
            expect(addEventListener).not.toHaveBeenCalled();
        });

        it('swallows a rejected register() rather than surfacing an unhandled rejection', async () => {
            const container = { register: vi.fn(() => Promise.reject(new Error('insecure context'))) };

            await expect(registerServiceWorker({ base: '/', container })).resolves.toBeNull();
            expect(addEventListener).not.toHaveBeenCalled();
        });
    });

    describe('update check on visibilitychange', () => {
        // Fake timers go in BEFORE the registration, so the hook's internal
        // `lastCheck = Date.now()` is stamped on the fake clock. Installing them
        // afterwards silently adds however many real milliseconds elapsed during
        // the await to every subsequent delta — enough that advancing by
        // INTERVAL - 1 reads as INTERVAL and the "inside the window" test fails
        // on a slow machine. Vitest does not fake microtasks, so the await below
        // still resolves normally.
        const arm = async (registration) => {
            vi.useFakeTimers();
            const container = makeContainer(registration);
            await registerServiceWorker({ base: '/', container });
            return container.registration;
        };

        it('ignores a visibilitychange that is not a return to visible', async () => {
            const registration = await arm();
            setVisibility('hidden');

            visibilityHandler()();

            expect(registration.update).not.toHaveBeenCalled();
        });

        it('does not re-check inside the throttle window', async () => {
            // visibilitychange fires constantly and each check is a network
            // request; unthrottled this would hammer the origin.
            const registration = await arm();
            vi.advanceTimersByTime(UPDATE_CHECK_INTERVAL_MS - 1);

            visibilityHandler()();

            expect(registration.update).not.toHaveBeenCalled();
        });

        it('re-checks once the throttle window has exactly elapsed', async () => {
            // The comparison is `<`, so the boundary itself must pass.
            const registration = await arm();
            vi.advanceTimersByTime(UPDATE_CHECK_INTERVAL_MS);

            visibilityHandler()();

            expect(registration.update).toHaveBeenCalledTimes(1);
        });

        it('restarts the throttle window after each check', async () => {
            // Pins lastCheck being reassigned. Without it the first check would
            // permanently satisfy the elapsed test and every subsequent
            // visibilitychange would fire a request.
            const registration = await arm();
            const handler = visibilityHandler();

            vi.advanceTimersByTime(UPDATE_CHECK_INTERVAL_MS);
            handler();
            handler();
            expect(registration.update).toHaveBeenCalledTimes(1);

            vi.advanceTimersByTime(UPDATE_CHECK_INTERVAL_MS);
            handler();
            expect(registration.update).toHaveBeenCalledTimes(2);
        });

        it('swallows a rejected update() and still checks again later', async () => {
            // A failed check is normal — the device may simply be offline — and
            // must neither surface an unhandled rejection nor wedge the throttle.
            const registration = { update: vi.fn(() => Promise.reject(new Error('offline'))) };
            await arm(registration);
            const handler = visibilityHandler();

            vi.advanceTimersByTime(UPDATE_CHECK_INTERVAL_MS);
            expect(() => handler()).not.toThrow();

            vi.advanceTimersByTime(UPDATE_CHECK_INTERVAL_MS);
            handler();
            expect(registration.update).toHaveBeenCalledTimes(2);
        });
    });
});
