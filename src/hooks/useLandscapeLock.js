// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { useCallback, useEffect, useState } from 'react';
import { useMediaQuery } from './useMediaQuery';

// Two separate capabilities, deliberately not conflated. Going fullscreen needs
// requestFullscreen, which iPhone Safari lacks entirely. *Rotating* additionally
// needs orientation.lock(), which Safari implements nowhere and which desktop
// Chrome and DevTools emulation advertise but reject at call time. Fullscreen is
// worth offering by itself — it reclaims the browser chrome either way — so a
// refused lock must never retract the fullscreen control.
const canFullscreen = () =>
    typeof document !== 'undefined' &&
    document.fullscreenEnabled === true &&
    typeof document.documentElement?.requestFullscreen === 'function';

const canLock = () =>
    typeof window !== 'undefined' &&
    typeof window.screen?.orientation?.lock === 'function';

export function useLandscapeLock() {
    // Touch input is the discriminator: a touchscreen laptop with a mouse still
    // reports fine, and desktop Chrome passes both capability probes below while
    // rejecting lock() at call time.
    const coarse = useMediaQuery('(pointer: coarse)');
    const [isFullscreen, setIsFullscreen] = useState(
        () => typeof document !== 'undefined' && !!document.fullscreenElement
    );
    // Set once lock() has actually been refused. Only downgrades the control
    // from "rotate" to plain "fullscreen" — it must not remove it, since the
    // fullscreen half of enter() succeeded and still works.
    const [lockRejected, setLockRejected] = useState(false);

    // The UA releases the orientation lock whenever the document leaves
    // fullscreen, and the user can leave via Esc, the system back gesture or a
    // swipe — none of which call exit(). So fullscreenElement is the only
    // trustworthy source of truth, and tracking the lock separately would drift.
    useEffect(() => {
        if (typeof document === 'undefined') return undefined;
        const onChange = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', onChange);
        return () => document.removeEventListener('fullscreenchange', onChange);
    }, []);

    // Whether to offer the control at all.
    const available = coarse && canFullscreen();
    // Whether that control will also rotate, which decides its icon and label.
    const canRotate = available && canLock() && !lockRejected;

    const enter = useCallback(async () => {
        // Fullscreen the documentElement, never the app's root node: the root is
        // conditionally rendered, and unmounting the fullscreen element exits
        // fullscreen and drops the lock. The UA's :fullscreen stylesheet would
        // also override the root's own width constraints.
        try {
            await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
        } catch {
            return;
        }
        if (!canLock()) return;
        try {
            // Must await the fullscreen request first — lock() rejects unless the
            // document is already fullscreen at call time.
            await window.screen.orientation.lock('landscape');
        } catch {
            // Keep the fullscreen that did succeed; just stop promising rotation.
            setLockRejected(true);
        }
    }, []);

    const exit = useCallback(async () => {
        // Leaving fullscreen releases the lock implicitly. Calling unlock() first
        // would rotate and then exit, as two separate visible transitions.
        try {
            await document.exitFullscreen();
        } catch {
            // Already exited.
        }
    }, []);

    return { available, canRotate, isFullscreen, enter, exit };
}
