// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

// Runs the real public/sw.js under a fake ServiceWorkerGlobalScope so the whole
// worker can be unit-tested without a browser.
//
// The worker is loaded by reading its source and evaluating it, rather than by
// importing it, for two reasons. It is a classic worker script with no imports
// and no exports — there is nothing to import — and evaluating it gives a fresh
// worker per test, which matters: sw.js carries mutable module state
// (putsSinceTrim, seeded at the trim threshold, and the shellUrlSet memo) that a
// cached ES module would share across tests and make untestable.
//
// Known cost: v8 cannot instrument code evaluated this way, so the service
// worker reads 0% in the coverage report despite being covered here. See TODO.md.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { vi } from 'vitest';

// Resolved from this module rather than cwd so the suite runs from anywhere.
// Deliberately not `new URL('...', import.meta.url)`: the jsdom environment
// replaces the global URL with jsdom's, which ignores a file: base entirely and
// resolves against the document origin — that expression yields
// http://localhost:3000/sw.js here, not a path.
const SW_SOURCE_PATH = join(import.meta.dirname, '../../public/sw.js');

let swSource = null;

const urlOf = (requestOrUrl) => (typeof requestOrUrl === 'string' ? requestOrUrl : requestOrUrl.url);
const headersOf = (requestOrUrl) =>
    (typeof requestOrUrl === 'string' ? new Headers() : requestOrUrl.headers ?? new Headers());

// Cache Storage matching is not URL-only: if the stored response carries a
// `Vary` header, a later request whose corresponding headers differ is NOT a
// match unless the caller passes `ignoreVary`. Modelling that faithfully is the
// entire point of this stub. The 1.7.1 blank screen was exactly this — precache
// entries stored from a plain worker fetch, unmatchable by the page's CORS
// module-script request once the host answered `Vary: Origin` — and a URL-only
// stub would have waved the buggy code straight through.
const varyMatches = (entry, reqHeaders) => {
    const vary = entry.response.headers?.get?.('vary');
    if (!vary) return true;
    if (vary.trim() === '*') return false;
    return vary
        .split(',')
        .map((h) => h.trim().toLowerCase())
        .every((h) => reqHeaders.get(h) === entry.reqHeaders.get(h));
};

class StubCache {
    // Insertion-ordered, because Cache Storage is, and the worker's FIFO trim
    // depends on it.
    entries = [];

    async put(requestOrUrl, response) {
        const url = urlOf(requestOrUrl);
        const entry = { url, reqHeaders: headersOf(requestOrUrl), response };
        const existing = this.entries.findIndex((e) => e.url === url);
        if (existing >= 0) this.entries[existing] = entry;
        else this.entries.push(entry);
    }

    async match(requestOrUrl, options = {}) {
        const url = urlOf(requestOrUrl);
        const reqHeaders = headersOf(requestOrUrl);
        const hit = this.entries.find(
            (e) => e.url === url && (options.ignoreVary || varyMatches(e, reqHeaders)),
        );
        return hit?.response;
    }

    async keys() {
        return this.entries.map((e) => new Request(e.url));
    }

    async delete(requestOrUrl) {
        const url = urlOf(requestOrUrl);
        const i = this.entries.findIndex((e) => e.url === url);
        if (i < 0) return false;
        this.entries.splice(i, 1);
        return true;
    }

    // Test affordance: the URLs currently held, in insertion order.
    urls() {
        return this.entries.map((e) => e.url);
    }
}

class StubCacheStorage {
    caches = new Map();

    async open(name) {
        if (!this.caches.has(name)) this.caches.set(name, new StubCache());
        return this.caches.get(name);
    }

    async keys() {
        return [...this.caches.keys()];
    }

    async delete(name) {
        return this.caches.delete(name);
    }
}

// A 200 with an optional Vary, for stubbing fetch.
export const okResponse = (body = '', init = {}) => new Response(body, { status: 200, ...init });

// Navigation events must use a plain object rather than a real Request:
// `Request.mode` is read-only and cannot be set to 'navigate'. The fetch handler
// only ever reads url/method/mode, so this is sufficient — do not "fix" it into
// a real Request, or the entire navigation branch silently stops being tested.
export const navigateRequest = (url) => ({ url, method: 'GET', mode: 'navigate' });

/**
 * Evaluate public/sw.js under a fake global scope.
 *
 * @returns the scope, its caches, the fetch mock, and a `dispatch` that awaits
 *          whatever the handler passed to waitUntil/respondWith.
 */
export function loadServiceWorker({
    scope = 'https://example.test/quick-beats/',
    version = '1.7.1',
    buildAssets = [],
    fetch: fetchImpl,
    // Escape hatch for proving a test can fail: mutate the source before it runs.
    transformSource = (src) => src,
} = {}) {
    // Read once for the whole file rather than on each of the ~36 loads: the
    // source cannot change mid-run, and each load already pays for compiling it.
    swSource ??= readFileSync(SW_SOURCE_PATH, 'utf-8');
    const rawSource = swSource;

    // Exactly the substitution stampServiceWorkerVersion performs at build time
    // (see vite.config.js), so these tests exercise the worker as it ships.
    const stamped = rawSource
        .replaceAll('__APP_VERSION__', version)
        .replace('/* __BUILD_ASSETS__ */', buildAssets.map((file) => JSON.stringify(file)).join(', '));

    const listeners = new Map();
    const caches = new StubCacheStorage();
    const clients = { claim: vi.fn(() => Promise.resolve()) };
    const consoleStub = { warn: vi.fn(), error: vi.fn(), log: vi.fn() };
    const fetchMock = fetchImpl ?? vi.fn(() => Promise.resolve(okResponse()));

    const self = {
        registration: { scope },
        location: new URL(scope),
        clients,
        // Present so a test can assert it is never called — dropping skipWaiting
        // is what keeps an update from pulling assets out from under a live page.
        skipWaiting: vi.fn(),
        addEventListener: (type, handler) => listeners.set(type, handler),
    };

    // Returning the worker's own constants means a change in sw.js flows into
    // the tests instead of drifting from a second copy of the numbers here.
    const constants = new Function(
        'self',
        'caches',
        'fetch',
        'console',
        `${transformSource(stamped)}
        return { SHELL_CACHE, RUNTIME_CACHE, SHELL_ASSETS, BUILD_ASSETS, RUNTIME_MAX_ENTRIES, TRIM_EVERY_N_PUTS };`,
    )(self, caches, fetchMock, consoleStub);

    const scoped = (path) => new URL(path, scope).href;

    const dispatch = async (type, init = {}) => {
        const handler = listeners.get(type);
        if (!handler) throw new Error(`sw.js registered no "${type}" listener`);

        let waited = null;
        let responded = null;
        handler({
            ...init,
            waitUntil: (p) => { waited = p; },
            respondWith: (p) => { responded = p; },
        });

        return {
            // Distinguishes "handled and resolved to undefined" from "never
            // called", which is the assertion for the pass-through branches.
            respondWithCalled: responded !== null,
            waited: await waited,
            response: await responded,
        };
    };

    // install then activate, the state every fetch test starts from.
    const boot = async () => {
        await dispatch('install');
        await dispatch('activate');
    };

    return {
        ...constants,
        rawSource,
        self,
        caches,
        clients,
        console: consoleStub,
        fetch: fetchMock,
        listeners,
        scoped,
        dispatch,
        boot,
    };
}
