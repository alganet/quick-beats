// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

// Nearly every comment in public/sw.js documents a bug that was actually fixed
// — a blank launch, a broken update, an unbounded cache — so nearly every test
// here is a regression test rather than a specification.

import { describe, it, expect, vi } from 'vitest';
import { loadServiceWorker, okResponse, navigateRequest } from './serviceWorkerHarness';

const SCOPE = 'https://example.test/quick-beats/';
const ASSET = 'assets/index-abc123.js';

// cacheFirst deliberately does not await its cache.put or its trim — the
// response goes back to the page first. Tests that assert on the cache have to
// let those settle.
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const varying = (header) => vi.fn(() => Promise.resolve(okResponse('body', { headers: { Vary: header } })));
const corsRequest = (url) => new Request(url, { headers: { Origin: 'https://example.test' } });

describe('build-time placeholders', () => {
    it('still ships the placeholders stampServiceWorkerVersion substitutes', () => {
        // Renaming either in sw.js without updating vite.config.js would emit an
        // unstamped worker: every release would share one cache name and serve
        // the previous version's assets forever.
        const { rawSource } = loadServiceWorker();
        expect(rawSource).toContain('__APP_VERSION__');
        expect(rawSource).toContain('/* __BUILD_ASSETS__ */');
    });

    it('names its caches after the stamped version', () => {
        const sw = loadServiceWorker({ version: '9.9.9' });
        expect(sw.SHELL_CACHE).toBe('qb-shell-9.9.9');
        expect(sw.RUNTIME_CACHE).toBe('qb-runtime-9.9.9');
    });
});

describe('install', () => {
    it('precaches every shell asset resolved against the registration scope', async () => {
        const sw = loadServiceWorker();
        await sw.dispatch('install');

        const shell = await sw.caches.open(sw.SHELL_CACHE);
        expect(shell.urls()).toHaveLength(sw.SHELL_ASSETS.length);
        // Scope-relative, not root-relative — the app lives under /quick-beats/.
        expect(shell.urls()).toContain(`${SCOPE}manifest.webmanifest`);
        expect(shell.urls()).not.toContain('https://example.test/manifest.webmanifest');
    });

    it('stores the shell document under both ./ and index.html', async () => {
        // Listed twice on purpose: a host that answers only one of the two still
        // yields a usable shell, and navigationHandler tries both.
        const sw = loadServiceWorker();
        await sw.dispatch('install');

        const shell = await sw.caches.open(sw.SHELL_CACHE);
        expect(shell.urls()).toContain(SCOPE);
        expect(shell.urls()).toContain(`${SCOPE}index.html`);
    });

    it('installs successfully when some precache entries fail (partial beats atomic)', async () => {
        // cache.addAll is atomic: one flaky request on a mobile connection would
        // reject the whole install, Chrome would discard the worker, and the next
        // launch would race the same install again. A partial precache degrades.
        const fetchMock = vi.fn((url) => {
            if (url.endsWith('logo.svg')) return Promise.reject(new Error('offline'));
            if (url.endsWith('icon-512.png')) return Promise.resolve(new Response('', { status: 404 }));
            return Promise.resolve(okResponse());
        });
        const sw = loadServiceWorker({ fetch: fetchMock });

        await expect(sw.dispatch('install')).resolves.toBeDefined();

        const shell = await sw.caches.open(sw.SHELL_CACHE);
        expect(shell.urls()).toHaveLength(sw.SHELL_ASSETS.length - 2);
        expect(sw.console.warn).toHaveBeenCalledWith(
            expect.stringContaining(`2/${sw.SHELL_ASSETS.length} precache entries failed`),
            expect.anything(),
        );
    });

    it('never stores a non-ok precache response', async () => {
        // A cached 404 shell is not a degraded launch, it is a permanent blank one.
        const sw = loadServiceWorker({ fetch: vi.fn(() => Promise.resolve(new Response('', { status: 404 }))) });
        await sw.dispatch('install');

        const shell = await sw.caches.open(sw.SHELL_CACHE);
        expect(shell.urls()).toHaveLength(0);
    });

    it("forces cache: 'reload' for shell assets but not for hashed build assets", async () => {
        // The unhashed entries can go stale, so a reinstall must bypass the HTTP
        // cache. Forcing it on the hashed bundle would re-download everything the
        // page just fetched, over the same slow connection the install must survive.
        const sw = loadServiceWorker({ buildAssets: [ASSET] });
        await sw.dispatch('install');

        expect(sw.fetch).toHaveBeenCalledWith(`${SCOPE}index.html`, { cache: 'reload' });
        expect(sw.fetch).toHaveBeenCalledWith(`${SCOPE}${ASSET}`, undefined);
    });

    it('precaches the hashed build assets alongside the shell', async () => {
        // The SW registers on window load, after the page has already fetched its
        // JS and CSS, so on the installing visit those requests are never
        // intercepted — leaving them to runtime caching means a first offline
        // launch renders a blank page.
        const sw = loadServiceWorker({ buildAssets: [ASSET, 'assets/index-def456.css'] });
        await sw.dispatch('install');

        const shell = await sw.caches.open(sw.SHELL_CACHE);
        expect(shell.urls()).toContain(`${SCOPE}${ASSET}`);
        expect(shell.urls()).toContain(`${SCOPE}assets/index-def456.css`);
    });

    it('never calls skipWaiting', async () => {
        // A new worker that seizes a running page and then purges the old caches
        // in activate pulls assets out from under a document still loading them.
        const sw = loadServiceWorker();
        await sw.dispatch('install');
        expect(sw.self.skipWaiting).not.toHaveBeenCalled();
    });
});

describe('activate', () => {
    it('deletes cache keys from other versions and leaves the current ones', async () => {
        const sw = loadServiceWorker({ version: '1.7.1' });
        await sw.caches.open('qb-shell-1.7.0');
        await sw.caches.open('qb-runtime-1.7.0');
        await sw.caches.open(sw.SHELL_CACHE);
        await sw.caches.open(sw.RUNTIME_CACHE);

        await sw.dispatch('activate');

        expect(await sw.caches.keys()).toEqual([sw.SHELL_CACHE, sw.RUNTIME_CACHE]);
    });

    it('claims clients once the purge is done', async () => {
        const sw = loadServiceWorker();
        await sw.caches.open('qb-shell-0.0.1');

        await sw.dispatch('activate');

        expect(sw.clients.claim).toHaveBeenCalledTimes(1);
        expect(await sw.caches.keys()).not.toContain('qb-shell-0.0.1');
    });
});

describe('cacheFirst', () => {
    it('serves a cached response without touching the network', async () => {
        const sw = loadServiceWorker();
        await sw.boot();
        sw.fetch.mockClear();

        const { response } = await sw.dispatch('fetch', {
            request: new Request(`${SCOPE}manifest.webmanifest`),
        });

        expect(response).toBeDefined();
        expect(sw.fetch).not.toHaveBeenCalled();
    });

    it('matches a Vary: Origin precache entry against the page CORS request', async () => {
        // The 1.7.1 blank screen. Precache entries are stored from a plain fetch
        // inside the worker; the page then asks for its bundle as a module script,
        // a CORS request carrying an Origin header the precache fetch never had.
        // A host answering `Vary: Origin` (vite preview) or `Vary: Accept-Encoding`
        // (most CDNs) makes the precached JS unmatchable unless every read passes
        // ignoreVary — and an unmatchable bundle is a launch with no script.
        const sw = loadServiceWorker({ buildAssets: [ASSET], fetch: varying('Origin') });
        await sw.boot();
        sw.fetch.mockClear();

        const { response } = await sw.dispatch('fetch', { request: corsRequest(sw.scoped(ASSET)) });

        expect(response).toBeDefined();
        expect(sw.fetch).not.toHaveBeenCalled();
    });

    it('matches a Vary: Accept-Encoding entry too (what GitHub Pages answers)', async () => {
        const sw = loadServiceWorker({ buildAssets: [ASSET], fetch: varying('Accept-Encoding') });
        await sw.boot();
        sw.fetch.mockClear();

        const { response } = await sw.dispatch('fetch', {
            request: new Request(sw.scoped(ASSET), { headers: { 'Accept-Encoding': 'gzip' } }),
        });

        expect(response).toBeDefined();
        expect(sw.fetch).not.toHaveBeenCalled();
    });

    it('discriminates on Vary when ignoreVary is not passed', async () => {
        // Guards the two tests above from passing vacuously. If the harness stub
        // ignored Vary unconditionally it would green-light the exact bug it
        // exists to catch, and every assertion built on it would be worthless.
        const sw = loadServiceWorker({ buildAssets: [ASSET], fetch: varying('Origin') });
        await sw.dispatch('install');

        const shell = await sw.caches.open(sw.SHELL_CACHE);
        expect(await shell.match(corsRequest(sw.scoped(ASSET)))).toBeUndefined();
        expect(await shell.match(corsRequest(sw.scoped(ASSET)), { ignoreVary: true })).toBeDefined();
    });

    it('caches a 200 runtime response', async () => {
        const sw = loadServiceWorker();
        await sw.boot();

        await sw.dispatch('fetch', { request: new Request(`${SCOPE}samples/kick.wav`) });
        await flush();

        const runtime = await sw.caches.open(sw.RUNTIME_CACHE);
        expect(runtime.urls()).toEqual([`${SCOPE}samples/kick.wav`]);
    });

    it('never caches a 206 Partial Content', async () => {
        // Audio elements issue Range requests. A cached 206 served on a later hit
        // breaks playback outright.
        const sw = loadServiceWorker({ fetch: vi.fn(() => Promise.resolve(new Response('pcm', { status: 206 }))) });
        await sw.boot();

        await sw.dispatch('fetch', { request: new Request(`${SCOPE}samples/snare.wav`) });
        await flush();

        const runtime = await sw.caches.open(sw.RUNTIME_CACHE);
        expect(runtime.urls()).toHaveLength(0);
    });

    it('serves a precached /assets/ file from the shell without a duplicate runtime copy', async () => {
        const sw = loadServiceWorker({ buildAssets: [ASSET] });
        await sw.boot();
        sw.fetch.mockClear();

        await sw.dispatch('fetch', { request: new Request(sw.scoped(ASSET)) });
        await flush();

        const runtime = await sw.caches.open(sw.RUNTIME_CACHE);
        expect(runtime.urls()).toHaveLength(0);
        expect(sw.fetch).not.toHaveBeenCalled();
    });

    it('does not probe the shell cache for samples', async () => {
        // Samples are never precached, so a shell lookup would be pure overhead
        // on the hottest path in the app — dozens of requests during the kit
        // prefetch storm, on a worker thread that is already the bottleneck.
        const sw = loadServiceWorker();
        await sw.boot();

        const shell = await sw.caches.open(sw.SHELL_CACHE);
        const shellMatch = vi.spyOn(shell, 'match');

        await sw.dispatch('fetch', { request: new Request(`${SCOPE}samples/hat.wav`) });
        await flush();

        expect(shellMatch).not.toHaveBeenCalled();
    });
});

describe('runtime cache trim', () => {
    // Fills the runtime cache past its cap, bypassing the worker so the put
    // counter is untouched.
    const seedRuntime = async (sw, count) => {
        const runtime = await sw.caches.open(sw.RUNTIME_CACHE);
        for (let i = 0; i < count; i++) await runtime.put(`${SCOPE}samples/seed-${i}.wav`, okResponse());
        return runtime;
    };

    it('trims on the very first runtime put of a worker lifetime', async () => {
        // putsSinceTrim is seeded at the threshold rather than at 0, and that is
        // load-bearing: the counter dies with the worker (~30s idle), so a user
        // who caches one kit per session — fewer puts than the threshold, every
        // time — would never trim at all and the cap would never bind.
        const sw = loadServiceWorker();
        await sw.boot();
        const runtime = await seedRuntime(sw, sw.RUNTIME_MAX_ENTRIES + 5);

        await sw.dispatch('fetch', { request: new Request(`${SCOPE}samples/new.wav`) });
        await flush();

        expect(runtime.urls()).toHaveLength(sw.RUNTIME_MAX_ENTRIES);
    });

    it('evicts the oldest entries first', async () => {
        const sw = loadServiceWorker();
        await sw.boot();
        // Exactly at the cap, so the one new entry evicts exactly one — the oldest.
        const runtime = await seedRuntime(sw, sw.RUNTIME_MAX_ENTRIES);

        await sw.dispatch('fetch', { request: new Request(`${SCOPE}samples/new.wav`) });
        await flush();

        expect(runtime.urls()).toHaveLength(sw.RUNTIME_MAX_ENTRIES);
        expect(runtime.urls()).not.toContain(`${SCOPE}samples/seed-0.wav`);
        expect(runtime.urls()).toContain(`${SCOPE}samples/seed-1.wav`);
        expect(runtime.urls()).toContain(`${SCOPE}samples/new.wav`);
    });

    it('then only rescans the keys once every TRIM_EVERY_N_PUTS puts', async () => {
        // Scanning 400 keys on every put thrashes the worker thread exactly when
        // it is busiest — the prefetch storm is dozens of puts back to back.
        const sw = loadServiceWorker();
        await sw.boot();
        const runtime = await sw.caches.open(sw.RUNTIME_CACHE);

        const put = async (n) => {
            await sw.dispatch('fetch', { request: new Request(`${SCOPE}samples/s-${n}.wav`) });
            await flush();
        };

        await put(0); // the seeded first-put trim
        const keys = vi.spyOn(runtime, 'keys');

        for (let i = 1; i < sw.TRIM_EVERY_N_PUTS; i++) await put(i);
        expect(keys).not.toHaveBeenCalled();

        await put(sw.TRIM_EVERY_N_PUTS);
        expect(keys).toHaveBeenCalledTimes(1);
    });

    it('never trims the shell cache', async () => {
        const sw = loadServiceWorker();
        await sw.boot();
        const shell = await sw.caches.open(sw.SHELL_CACHE);
        const before = shell.urls().length;

        for (let i = 0; i <= sw.TRIM_EVERY_N_PUTS; i++) {
            await sw.dispatch('fetch', { request: new Request(`${SCOPE}samples/s-${i}.wav`) });
        }
        await flush();

        expect(shell.urls()).toHaveLength(before);
    });
});

describe('navigationHandler', () => {
    it('answers a navigation from the precached shell with no network in the path', async () => {
        // A launch must never depend on the network: an installed PWA has no
        // address bar and no obvious reload, so a launch waiting on a flaky
        // connection is a blank screen with no way out.
        const sw = loadServiceWorker();
        await sw.boot();
        sw.fetch.mockClear();

        const { response } = await sw.dispatch('fetch', { request: navigateRequest(SCOPE) });

        expect(response).toBeDefined();
        expect(sw.fetch).not.toHaveBeenCalled();
    });

    it('falls back to ./ when index.html was never precached', async () => {
        const sw = loadServiceWorker({
            fetch: vi.fn((url) =>
                url.endsWith('index.html')
                    ? Promise.resolve(new Response('', { status: 404 }))
                    : Promise.resolve(okResponse('shell'))),
        });
        await sw.boot();
        sw.fetch.mockClear();

        const { response } = await sw.dispatch('fetch', { request: navigateRequest(`${SCOPE}anything`) });

        expect(await response.text()).toBe('shell');
        expect(sw.fetch).not.toHaveBeenCalled();
    });

    it('falls back to the network when nothing was precached', async () => {
        const sw = loadServiceWorker({ fetch: vi.fn(() => Promise.resolve(new Response('', { status: 404 }))) });
        await sw.boot();
        sw.fetch.mockClear();
        sw.fetch.mockResolvedValueOnce(okResponse('from network'));

        const { response } = await sw.dispatch('fetch', { request: navigateRequest(SCOPE) });

        expect(await response.text()).toBe('from network');
    });

    it('rebuilds a redirected network response as a plain one', async () => {
        // A redirected response handed back for a navigate request — whose
        // redirect mode is 'manual' — fails the navigation outright. Another
        // blank screen.
        const redirected = {
            redirected: true,
            status: 200,
            statusText: 'OK',
            headers: new Headers({ 'content-type': 'text/html' }),
            body: 'redirected shell',
        };
        const sw = loadServiceWorker({ fetch: vi.fn(() => Promise.resolve(new Response('', { status: 404 }))) });
        await sw.boot();
        sw.fetch.mockClear();
        sw.fetch.mockResolvedValueOnce(redirected);

        const { response } = await sw.dispatch('fetch', { request: navigateRequest(SCOPE) });

        expect(response.redirected).toBe(false);
        expect(response.status).toBe(200);
        expect(response.headers.get('content-type')).toBe('text/html');
        expect(await response.text()).toBe('redirected shell');
    });

    it('returns an error response when the network fails offline', async () => {
        const sw = loadServiceWorker({ fetch: vi.fn(() => Promise.resolve(new Response('', { status: 404 }))) });
        await sw.boot();
        sw.fetch.mockClear();
        sw.fetch.mockRejectedValueOnce(new Error('offline'));

        const { response } = await sw.dispatch('fetch', { request: navigateRequest(SCOPE) });

        expect(response.type).toBe('error');
    });
});

describe('fetch handler routing', () => {
    it('ignores non-GET requests', async () => {
        const sw = loadServiceWorker();
        await sw.boot();

        const { respondWithCalled } = await sw.dispatch('fetch', {
            request: new Request(`${SCOPE}samples/kick.wav`, { method: 'POST' }),
        });

        expect(respondWithCalled).toBe(false);
    });

    it('ignores cross-origin requests', async () => {
        const sw = loadServiceWorker();
        await sw.boot();

        const { respondWithCalled } = await sw.dispatch('fetch', {
            request: new Request('https://www.googletagmanager.com/gtag/js'),
        });

        expect(respondWithCalled).toBe(false);
    });

    it.each([
        ['samples/kick.wav'],
        ['models/groovae/weights.bin'],
        ['groove.wasm'],
        ['assets/index-abc123.js'],
    ])('handles %s as a runtime asset', async (path) => {
        const sw = loadServiceWorker();
        await sw.boot();

        const { respondWithCalled } = await sw.dispatch('fetch', { request: new Request(`${SCOPE}${path}`) });

        expect(respondWithCalled).toBe(true);
    });

    it('serves precached shell extras like the manifest and icons from the cache', async () => {
        // These were precached but nothing ever served them, so an offline launch
        // still went to the network for its manifest and got nothing.
        const sw = loadServiceWorker();
        await sw.boot();
        sw.fetch.mockClear();

        for (const path of ['manifest.webmanifest', 'icon-192.png', 'logo.svg']) {
            const { response } = await sw.dispatch('fetch', { request: new Request(`${SCOPE}${path}`) });
            expect(response).toBeDefined();
        }
        expect(sw.fetch).not.toHaveBeenCalled();
    });

    it('leaves an unrecognised same-origin GET to the network', async () => {
        const sw = loadServiceWorker();
        await sw.boot();

        const { respondWithCalled } = await sw.dispatch('fetch', { request: new Request(`${SCOPE}api/stats`) });

        expect(respondWithCalled).toBe(false);
    });
});
