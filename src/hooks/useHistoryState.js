// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { useEffect, useRef, useCallback } from 'react';
import { buildShareHash } from '../utils/hashState';
import { buildRoute, parseRoute } from '../utils/routeState';

const HASH_SYNC_DELAY_MS = 180;

// Owns every write to browser history. Two concerns share one hook because they
// write the same URL and must not race:
//
//   1. Beat sync — mirror the live pattern into the hash so the page is always
//      shareable, debounced (rapid edits coalesce) via replaceState. Now
//      overlay-aware: while a modal is open it writes `#help~beat`, never a bare
//      `#beat` that would drop the overlay.
//   2. Named overlays — opening Help/Share pushes a back-poppable history entry
//      immediately (no debounce, so the modal feels instant); the browser Back
//      button, the close button, and Escape all funnel through history.back(),
//      and popstate is the single authoritative place that closes an overlay.
//
// Every entry we own is stamped `history.state = { qb: 1, overlay }`. That stamp
// lets popstate know which overlay to show and lets the external-hash listener
// tell our own back/forward navigations apart from a genuinely external link.
export function useHistoryState({
    isSetup,
    timeSignature,
    grid,
    bpmInput,
    activeKit,
    overlay = 'none',
    onPopOverlay,
    onExternalHash,
}) {
    const lastHashRef = useRef(
        typeof window !== 'undefined' && window.location.hash ? window.location.hash.substring(1) : ''
    );
    const hashSyncTimeoutRef = useRef(null);

    // Latest inputs, so the imperative openOverlay can read the current beat
    // without being re-created (and re-wired through App) on every edit. Written
    // in an effect (not during render) and only read from event handlers, which
    // always run after the effect has committed.
    const stateRef = useRef({ isSetup, timeSignature, grid, bpmInput, activeKit });
    useEffect(() => {
        stateRef.current = { isSetup, timeSignature, grid, bpmInput, activeKit };
    });

    const currentBeat = () => {
        const s = stateRef.current;
        if (s.isSetup && s.timeSignature && s.grid.length > 0) {
            return buildShareHash({ bpm: s.bpmInput, sigName: s.timeSignature.name, kitId: s.activeKit, grid: s.grid });
        }
        return null;
    };

    // Beat sync (debounced replaceState). `overlay` is a dependency so the write
    // carries whatever modal is open; opening one schedules a write that lands on
    // the just-pushed entry's URL (equal → skipped by the lastHashRef guard).
    useEffect(() => {
        if (isSetup && timeSignature && grid.length > 0) {
            if (hashSyncTimeoutRef.current) {
                clearTimeout(hashSyncTimeoutRef.current);
            }

            hashSyncTimeoutRef.current = setTimeout(() => {
                const beat = buildShareHash({ bpm: bpmInput, sigName: timeSignature.name, kitId: activeKit, grid });
                const body = buildRoute({ overlay, beat });
                if (body !== lastHashRef.current) {
                    window.history.replaceState({ qb: 1, overlay }, '', `#${body}`);
                    lastHashRef.current = body;
                }
                hashSyncTimeoutRef.current = null;
            }, HASH_SYNC_DELAY_MS);
        }

        return () => {
            if (hashSyncTimeoutRef.current) {
                clearTimeout(hashSyncTimeoutRef.current);
            }
        };
    }, [grid, bpmInput, timeSignature, isSetup, activeKit, overlay]);

    // Deep-link synthesis (once): a URL that already carries an overlay
    // (`#help~beat`, or a bare `#help`) is a single history entry, so Back would
    // leave the app instead of closing the modal. Lay a base entry beneath it so
    // Back closes the overlay to the beat/setup. A plain beat/empty URL is left
    // untouched here (it gets stamped lazily by the first beat-sync or openOverlay),
    // so the common load performs no history write on mount.
    useEffect(() => {
        // history.state survives a reload (and a StrictMode/remount re-run): if
        // this entry already carries our stamp, the base entry beneath it exists
        // from the last visit — synthesizing again would push one ghost entry
        // per reload, each demanding its own extra Back press.
        if (window.history.state?.qb) return;
        const { overlay: loaded, beat } = parseRoute(window.location.hash);
        if (loaded !== 'none') {
            const baseBody = buildRoute({ overlay: 'none', beat });
            window.history.replaceState(
                { qb: 1, overlay: 'none' }, '', baseBody ? `#${baseBody}` : window.location.pathname,
            );
            const overlayBody = buildRoute({ overlay: loaded, beat });
            window.history.pushState({ qb: 1, overlay: loaded }, '', `#${overlayBody}`);
            lastHashRef.current = overlayBody;
        }
    }, []);

    // Back / Forward: reconstruct the overlay from the target entry's stamp. This
    // is the ONLY place that closes an overlay, so the close button, Escape, and
    // the hardware Back button (all routed through history.back()) can't
    // double-close — they each produce exactly one popstate.
    useEffect(() => {
        if (!onPopOverlay) return undefined;
        const handlePop = (e) => onPopOverlay(e.state?.overlay ?? 'none');
        window.addEventListener('popstate', handlePop);
        return () => window.removeEventListener('popstate', handlePop);
    }, [onPopOverlay]);

    // External hash change — an installed PWA hands a tapped share link to the
    // running document as a fragment change (see the long note this replaced).
    // Skip entries we stamped: our own back/forward carries `qb`, so popstate
    // owns those; a genuine external link lands on a browser-created null state.
    useEffect(() => {
        if (!onExternalHash) return undefined;

        const handleHashChange = () => {
            if (window.history.state?.qb) return;
            const hash = window.location.hash.substring(1);
            if (hash === lastHashRef.current) return;
            lastHashRef.current = hash;
            onExternalHash(hash);
        };

        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, [onExternalHash]);

    // Push a modal onto history. Ensures the entry beneath is stamped first (so
    // Back lands on a recognised base), then pushes the overlay entry carrying
    // the newest beat.
    const openOverlay = useCallback((name) => {
        const beat = currentBeat();
        if (!window.history.state?.qb) {
            const baseBody = buildRoute({ overlay: 'none', beat });
            window.history.replaceState(
                { qb: 1, overlay: 'none' }, '', baseBody ? `#${baseBody}` : window.location.pathname,
            );
            lastHashRef.current = baseBody;
        }
        const body = buildRoute({ overlay: name, beat });
        window.history.pushState({ qb: 1, overlay: name }, '', `#${body}`);
        lastHashRef.current = body;
    }, []);

    return { openOverlay };
}
