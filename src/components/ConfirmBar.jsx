// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { useEffect, useRef } from "react";

export default function ConfirmBar({ measureIndex, onConfirm, onCancel }) {
    const cancelRef = useRef(null);

    // Auto-dismiss after 3 seconds
    useEffect(() => {
        const timer = setTimeout(() => {
            onCancel();
        }, 3000);
        return () => clearTimeout(timer);
    }, [onCancel]);

    // The delete button that opened this unmounts, which would drop keyboard
    // focus to <body>. Landing on No (not Yes) keeps a double-press from
    // confirming a destructive action.
    useEffect(() => {
        cancelRef.current?.focus();
    }, []);

    return (
        <div className="flex items-center justify-center gap-3 animate-in fade-in h-full">
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
