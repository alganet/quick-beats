// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { useCallback, useMemo, useSyncExternalStore } from 'react';

/**
 * Subscribes to a CSS media query, returning whether it currently matches.
 *
 * A MediaQueryList is an external store, so this reads it through
 * useSyncExternalStore rather than mirroring it into state — which would need a
 * setState inside an effect to stay in sync, and cascade a second render on
 * every mount.
 *
 * Defensive throughout: jsdom and SSR provide no matchMedia, and callers are
 * feature-detection paths that must still render rather than throw. A query
 * that cannot be evaluated reports false.
 */
export function useMediaQuery(query) {
    const mql = useMemo(() => {
        try {
            return window.matchMedia?.(query) ?? null;
        } catch {
            return null;
        }
    }, [query]);

    const subscribe = useCallback((onStoreChange) => {
        if (typeof mql?.addEventListener !== 'function') return () => { };
        mql.addEventListener('change', onStoreChange);
        return () => mql.removeEventListener('change', onStoreChange);
    }, [mql]);

    // Re-read the list rather than trusting a captured value: matches is updated
    // before the change event fires, so this stays correct if the query changes.
    const getSnapshot = useCallback(() => mql?.matches ?? false, [mql]);

    // Nothing to match against without a viewport.
    const getServerSnapshot = useCallback(() => false, []);

    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
