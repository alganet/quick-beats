// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { useEffect, useRef } from 'react';

const FOCUSABLE = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * The behavioural half of a modal dialog, shared by ShareModal, Help and
 * ErrorModal (the caller still supplies role="dialog"/"alertdialog",
 * aria-modal and aria-labelledby on the element this ref is attached to):
 *
 * - moves focus to the dialog's first focusable control on open;
 * - traps Tab / Shift+Tab inside it, so the sequencer behind the overlay is
 *   unreachable (with aria-modal, that also hides it from assistive tech);
 * - closes on Escape, stopping the event so the global shortcut handler and
 *   any dialog underneath don't act on the same press;
 * - restores focus to the element that opened it on close/unmount.
 *
 * `onClose` may be omitted for dialogs with no dismiss path (ErrorModal).
 *
 * @param {boolean} isOpen
 * @param {(() => void) | undefined} onClose
 * @returns {{ current: HTMLElement | null }} ref for the dialog element
 */
export function useDialog(isOpen, onClose) {
    const dialogRef = useRef(null);

    // Read through a ref so a fresh inline onClose each render doesn't tear
    // down and re-run the whole open effect (same pattern as useDismiss).
    const onCloseRef = useRef(onClose);
    useEffect(() => { onCloseRef.current = onClose; });

    useEffect(() => {
        if (!isOpen) return undefined;
        const dialog = dialogRef.current;
        if (!dialog) return undefined;

        const opener = document.activeElement;
        const focusables = () => Array.from(dialog.querySelectorAll(FOCUSABLE));

        (focusables()[0] ?? dialog).focus();

        const onKeyDown = (e) => {
            if (e.key === 'Escape') {
                if (onCloseRef.current) {
                    e.stopPropagation();
                    onCloseRef.current();
                }
                return;
            }
            if (e.key !== 'Tab') return;

            const els = focusables();
            if (els.length === 0) {
                e.preventDefault();
                return;
            }
            const first = els[0];
            const last = els[els.length - 1];
            const active = document.activeElement;
            // Focus outside the dialog (dropped by a re-render) re-enters at
            // the matching end instead of escaping into the page behind.
            if (e.shiftKey && (active === first || !dialog.contains(active))) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && (active === last || !dialog.contains(active))) {
                e.preventDefault();
                first.focus();
            }
        };
        dialog.addEventListener('keydown', onKeyDown);

        return () => {
            dialog.removeEventListener('keydown', onKeyDown);
            if (opener && typeof opener.focus === 'function' && document.contains(opener)) {
                opener.focus();
            }
        };
    }, [isOpen]);

    return dialogRef;
}
