// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { useEffect, useRef } from 'react';
import { buildShareHash } from '../utils/hashState';

const HASH_SYNC_DELAY_MS = 180;

// Mirror the live pattern into the URL hash so the page is always shareable by
// copying the address bar. Debounced so rapid edits / BPM drags coalesce into a
// single replaceState, and skipped when the hash hasn't actually changed.
//
// onExternalHash fires when the hash changes to something we didn't write —
// see the listener below for why that isn't just a browser back button.
export function useHashSync({ isSetup, timeSignature, grid, bpmInput, activeKit, onExternalHash }) {
    const lastHashRef = useRef(
        typeof window !== 'undefined' && window.location.hash ? window.location.hash.substring(1) : ''
    );
    const hashSyncTimeoutRef = useRef(null);

    useEffect(() => {
        if (isSetup && timeSignature && grid.length > 0) {
            if (hashSyncTimeoutRef.current) {
                clearTimeout(hashSyncTimeoutRef.current);
            }

            hashSyncTimeoutRef.current = setTimeout(() => {
                const hash = buildShareHash({ bpm: bpmInput, sigName: timeSignature.name, kitId: activeKit, grid });
                if (hash !== lastHashRef.current) {
                    window.history.replaceState(null, '', `#${hash}`);
                    lastHashRef.current = hash;
                }
                hashSyncTimeoutRef.current = null;
            }, HASH_SYNC_DELAY_MS);
        }

        return () => {
            if (hashSyncTimeoutRef.current) {
                clearTimeout(hashSyncTimeoutRef.current);
            }
        };
    }, [grid, bpmInput, timeSignature, isSetup, activeKit]);

    // An installed PWA is one long-lived document. Tapping a shared link hands
    // the URL to the running instance instead of loading the page again, and a
    // fragment-only change navigates the same document — so the module-level
    // parse that seeds the app on a cold load never runs a second time. Without
    // this the app keeps showing whatever it was already showing (the setup
    // screen, typically) and the shared beat is silently dropped.
    //
    // Our own writes go through replaceState, which does not fire hashchange;
    // the ref comparison is belt-and-braces for anything that does.
    useEffect(() => {
        if (!onExternalHash) return;

        const handleHashChange = () => {
            const hash = window.location.hash.substring(1);
            if (hash === lastHashRef.current) return;
            lastHashRef.current = hash;
            onExternalHash(hash);
        };

        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, [onExternalHash]);
}
