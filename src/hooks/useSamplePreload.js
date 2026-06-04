// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { useEffect, useRef, useState } from 'react';
import { prefetchKitSamples } from '../utils/preloadSamples';
import { DEFAULT_KIT_ID } from '../data/kit';

/**
 * Warms the drum samples into the HTTP cache on mount and reports progress so
 * the app can show a brief loading screen before any UX. Kept as its own hook
 * (rather than inlined in App) so tests can mock it and skip the gate.
 *
 * @returns {{ ready: boolean, progress: number }}
 */
export function useSamplePreload() {
    const [ready, setReady] = useState(false);
    const [progress, setProgress] = useState(0);
    const startedRef = useRef(false);

    useEffect(() => {
        // Guard StrictMode's double-invoke so the prefetch fires once. We don't
        // gate the resulting setState on a cleanup flag: App is the root and
        // never truly unmounts here, and gating would let StrictMode's first
        // cleanup suppress the only prefetch's completion (leaving us stuck on
        // the loading screen forever).
        if (startedRef.current) return;
        startedRef.current = true;

        prefetchKitSamples(DEFAULT_KIT_ID, setProgress)
            .catch(() => { /* prefetch never rejects, but never block the UI on it */ })
            .finally(() => setReady(true));
    }, []);

    return { ready, progress };
}
