// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { useEffect, useRef } from 'react';
import { buildShareHash } from '../utils/hashState';

const HASH_SYNC_DELAY_MS = 180;

// Mirror the live pattern into the URL hash so the page is always shareable by
// copying the address bar. Debounced so rapid edits / BPM drags coalesce into a
// single replaceState, and skipped when the hash hasn't actually changed.
export function useHashSync({ isSetup, timeSignature, grid, bpmInput, activeKit }) {
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
}
