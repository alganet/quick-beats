// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { useCallback, useEffect, useRef } from 'react';

// Zoom and auto-scroll toggles are debounced so a key held down (auto-repeat)
// settles on one final toggle instead of flickering through every intermediate.
const ACTION_DELAY_MS = 200;

// Global keyboard shortcuts for the sequencer:
//   Space  play / pause        ?  help
//   - / =  BPM down / up       z  cycle zoom (debounced)
//   s      toggle auto-scroll (debounced)   h  humanize toggle
//   Esc    close modals
// Ignored while typing in form controls. Pure side-effect hook (no return).
export function useKeyboardShortcuts({
    togglePlay,
    setBpmInput,
    setZoom,
    setAutoScroll,
    setIsHelpOpen,
    setIsShareOpen,
    humanizeAction,
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
            // Ignore when typing in form controls
            const tag = e.target?.tagName?.toLowerCase();
            if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

            // Space => play / pause
            if (e.code === 'Space' || e.key === ' ') {
                e.preventDefault();
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
            if (e.key === '=') {
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

            // Preserve existing Escape behavior for modals
            if (e.key === 'Escape') {
                setIsShareOpen(false);
                setIsHelpOpen(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [togglePlay, setBpmInput, setIsHelpOpen, setIsShareOpen, scheduleKeyboardZoomToggle, scheduleKeyboardAutoScrollToggle, humanizeAction]);
}
