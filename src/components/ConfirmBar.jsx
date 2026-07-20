// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { useEffect, useRef } from "react";

export default function ConfirmBar({ measureIndex, onConfirm, onCancel }) {
    const cancelRef = useRef(null);

    // No auto-dismiss: a destructive-delete confirmation must not vanish on a
    // timer (WCAG 2.2.1). It stays until the user resolves it — but it must
    // stay escapable: while pending, the measure is faded and locked, so with
    // the timer gone Escape is the way out that doesn't require finding the No
    // button. Window-level so it works wherever focus wandered; a dialog's own
    // Escape never reaches here (useDialog stops propagation).
    const onCancelRef = useRef(onCancel);
    useEffect(() => { onCancelRef.current = onCancel; });
    useEffect(() => {
        const onKeyDown = (e) => {
            if (e.key === 'Escape') onCancelRef.current?.();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, []);

    // The delete button that opened this unmounts, which would drop keyboard
    // focus to <body>. Landing on No (not Yes) keeps a double-press from
    // confirming a destructive action.
    useEffect(() => {
        cancelRef.current?.focus();
    }, []);

    return (
        <div className="flex items-center justify-center gap-3 h-full">
            <span className="text-[11px] font-mono text-danger uppercase tracking-wider whitespace-nowrap">
                Delete section {measureIndex + 1}?
            </span>
            <button
                onClick={(e) => { e.stopPropagation(); onConfirm(); }}
                className="text-[11px] font-mono font-bold text-danger hover:text-danger-dim bg-danger/10 hover:bg-danger/20 border border-danger/30 px-2.5 py-0.5 transition-all uppercase tracking-wider"
            >
                Yes
            </button>
            <button
                ref={cancelRef}
                onClick={(e) => { e.stopPropagation(); onCancel(); }}
                className="text-[11px] font-mono text-fg-muted hover:text-fg-secondary bg-highlight/5 hover:bg-highlight/10 border border-highlight/10 px-2.5 py-0.5 transition-all uppercase tracking-wider"
            >
                No
            </button>
        </div>
    );
}
