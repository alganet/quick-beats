// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { useCallback, useEffect, useRef } from 'react';

// Zoom and auto-scroll toggles are debounced so a key held down (auto-repeat)
// settles on one final toggle instead of flickering through every intermediate.
const ACTION_DELAY_MS = 200;

// Global keyboard shortcuts for the sequencer:
//   Space / p  play / pause     ?  help
//   - / =  BPM down / up        z  cycle zoom (debounced)
//   s      toggle auto-scroll (debounced)   h  humanize toggle
//   Esc    close modals
// (p is the single-key play/pause; Space also plays but yields to focused buttons.)
// Ignored while typing in form controls. The single-character shortcuts can be
// turned off via `singleKeyEnabled` (WCAG 2.1.4 — speech-input users fire them
// constantly); Space and Escape stay live. Pure side-effect hook (no return).
export function useKeyboardShortcuts({
    togglePlay,
    setBpmInput,
    setZoom,
    setAutoScroll,
    setIsHelpOpen,
    setIsShareOpen,
    humanizeAction,
    singleKeyEnabled = true,
}) {
    const keyboardZoomTimeoutRef = useRef(null);
    const keyboardAutoScrollTimeoutRef = useRef(null);

    useEffect(() => {
        return () => {
            if (keyboardZoomTimeoutRef.current) {
                clearTimeout(keyboardZoomTimeoutRef.current);
            }
            if (keyboardAutoScrollTimeoutRef.current) {
                clearTimeout(keyboardAutoScrollTimeoutRef.current);
            }
        };
    }, []);

    const scheduleKeyboardZoomToggle = useCallback(() => {
        if (keyboardZoomTimeoutRef.current) {
            clearTimeout(keyboardZoomTimeoutRef.current);
        }

        keyboardZoomTimeoutRef.current = setTimeout(() => {
            keyboardZoomTimeoutRef.current = null;
            setZoom((z) => (z + 1) % 3);
        }, ACTION_DELAY_MS);
    }, [setZoom]);

    const scheduleKeyboardAutoScrollToggle = useCallback(() => {
        if (keyboardAutoScrollTimeoutRef.current) {
            clearTimeout(keyboardAutoScrollTimeoutRef.current);
        }

        keyboardAutoScrollTimeoutRef.current = setTimeout(() => {
            keyboardAutoScrollTimeoutRef.current = null;
            setAutoScroll((a) => !a);
        }, ACTION_DELAY_MS);
    }, [setAutoScroll]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            // Browser and OS combos (Ctrl+S, Cmd+Z, ...) are not ours to hijack.
            if (e.ctrlKey || e.metaKey || e.altKey) return;

            // Ignore when typing in form controls
            const tag = e.target?.tagName?.toLowerCase();
            if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target?.isContentEditable) return;

            // Space => play / pause — except on a focused button or link, where
            // Space is the standard activation key: preventDefault on this
            // keydown swallows the element's click-on-keyup (verified in
            // Chromium), which would make Space activate nothing but playback.
            if (e.code === 'Space' || e.key === ' ') {
                if (tag === 'button' || tag === 'a') return;
                e.preventDefault();
                togglePlay?.();
                return;
            }

            // Escape stays live regardless of the single-key preference — it is
            // not a printable character, so 2.1.4 doesn't apply to it.
            if (e.key === 'Escape') {
                setIsShareOpen(false);
                setIsHelpOpen(false);
                return;
            }

            if (!singleKeyEnabled) return;

            // p => play / pause — a letter key that, unlike Space, is never
            // swallowed by a focused button, so it works from anywhere.
            if (typeof e.key === 'string' && e.key.toLowerCase() === 'p') {
                togglePlay?.();
                return;
            }

            // ? => show help
            if (e.key === '?') {
                setIsHelpOpen(true);
                return;
            }

            // - / = => BPM down / up (clamped to range used by UI)
            if (e.key === '-') {
                setBpmInput((prev) => Math.max(60, prev - 1));
                return;
            }
            // Accept both: the tooltip documents "+" (Shift+= or numpad), the
            // cheatsheet documents "=" — the unshifted key they share.
            if (e.key === '=' || e.key === '+') {
                setBpmInput((prev) => Math.min(240, prev + 1));
                return;
            }

            // z => toggle zoom
            if (typeof e.key === 'string' && e.key.toLowerCase() === 'z') {
                scheduleKeyboardZoomToggle();
                return;
            }

            // s => toggle auto-scroll
            if (typeof e.key === 'string' && e.key.toLowerCase() === 's') {
                scheduleKeyboardAutoScrollToggle();
                return;
            }

            // h => humanize / remove (same action as clicking the button)
            if (typeof e.key === 'string' && e.key.toLowerCase() === 'h') {
                humanizeAction();
                return;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [togglePlay, setBpmInput, setIsHelpOpen, setIsShareOpen, scheduleKeyboardZoomToggle, scheduleKeyboardAutoScrollToggle, humanizeAction, singleKeyEnabled]);
}
