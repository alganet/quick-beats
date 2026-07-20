// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { useState, useEffect, useCallback, useRef } from 'react';
import { useMediaQuery } from './useMediaQuery';

// iPadOS 13+ reports as "MacIntel", so a Mac with a touchscreen (i.e. an iPad)
// is treated as iOS too — that's the only Mac configuration with touch points.
function detectIOS() {
    if (typeof navigator === 'undefined') return false;
    return /iphone|ipad|ipod/i.test(navigator.userAgent)
        || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

// The app is an installable, offline-capable PWA, but nothing ever surfaced the
// install path — Chrome/Edge fire `beforeinstallprompt` and it was dropped, and
// the app couldn't tell it was already installed. This owns all of that:
//
//   canInstall     — a stashed beforeinstallprompt is ready; show an affordance.
//   promptInstall  — trigger the browser's install prompt (one-shot).
//   isStandalone   — running as an installed app (hide install hints / adapt UI).
//   isIOS          — iOS Safari never fires beforeinstallprompt; callers show a
//                    manual "Share -> Add to Home Screen" hint instead.
//
// onInstalled fires once the app is installed (via our prompt or the browser's
// own menu) so callers can announce it.
export function useInstallPrompt({ onInstalled } = {}) {
    const promptRef = useRef(null);
    const [canInstall, setCanInstall] = useState(false);
    const [isIOS] = useState(detectIOS);

    // display-mode:standalone covers Chrome/Android/desktop PWAs; navigator.standalone
    // is the iOS-only equivalent when launched from the home screen.
    const displayStandalone = useMediaQuery('(display-mode: standalone)');
    const isStandalone = displayStandalone
        || (typeof navigator !== 'undefined' && navigator.standalone === true);

    const onInstalledRef = useRef(onInstalled);
    useEffect(() => { onInstalledRef.current = onInstalled; });

    useEffect(() => {
        const handleBeforeInstall = (e) => {
            // Suppress the browser's own mini-infobar; we present our own control.
            e.preventDefault();
            promptRef.current = e;
            setCanInstall(true);
        };
        const handleInstalled = () => {
            promptRef.current = null;
            setCanInstall(false);
            onInstalledRef.current?.();
        };
        window.addEventListener('beforeinstallprompt', handleBeforeInstall);
        window.addEventListener('appinstalled', handleInstalled);
        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
            window.removeEventListener('appinstalled', handleInstalled);
        };
    }, []);

    const promptInstall = useCallback(async () => {
        const evt = promptRef.current;
        if (!evt) return;
        // The event is single-use: clear it and hide the affordance immediately,
        // whatever the user chooses in the native dialog.
        promptRef.current = null;
        setCanInstall(false);
        try {
            await evt.prompt();
            await evt.userChoice;
        } catch { /* user dismissed / prompt unavailable */ }
    }, []);

    return { canInstall, promptInstall, isStandalone, isIOS };
}
