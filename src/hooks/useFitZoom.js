// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { useEffect } from 'react';
import { fitZoom } from '../utils/sequencerGeometry';

/**
 * Picks a zoom that fits the grid into the height it actually has, until the
 * user expresses a preference of their own — `enabled` goes false the moment
 * they do, and their choice is never revisited.
 *
 * Sideways phones are the reason this exists: they leave roughly 300px for a
 * grid that wants 371 at the default zoom, so rows and the delete bar land
 * below the fold on the very orientation the app asks for.
 *
 * Driven by window resize rather than a ResizeObserver on the container: zoom
 * changes the grid's width, which can add or remove a horizontal scrollbar,
 * which changes the container's height — observing it would let the fit feed
 * back into itself and oscillate. The window's size has no such loop, and every
 * event that matters here (rotation, chrome collapsing, the short-landscape
 * breakpoint) goes through it.
 */
export function useFitZoom({ scrollContainerRef, enabled, rowCount, measureCount, onFit }) {
    useEffect(() => {
        if (!enabled) return undefined;

        const fit = () => {
            const container = scrollContainerRef.current;
            // Nothing laid out yet, so nothing to fit to.
            if (!container || container.clientHeight <= 0) return;
            onFit(fitZoom({
                availableHeightPx: container.clientHeight,
                rowCount,
                measureCount,
            }));
        };

        fit();
        window.addEventListener('resize', fit);
        window.addEventListener('orientationchange', fit);
        return () => {
            window.removeEventListener('resize', fit);
            window.removeEventListener('orientationchange', fit);
        };
    }, [scrollContainerRef, enabled, rowCount, measureCount, onFit]);
}
