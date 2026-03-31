// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { useEffect } from "react";

export default function ConfirmBar({ measureIndex, onConfirm, onCancel }) {
    // Auto-dismiss after 3 seconds
    useEffect(() => {
        const timer = setTimeout(() => {
            onCancel();
        }, 3000);
        return () => clearTimeout(timer);
    }, [onCancel]);

    return (
        <div className="flex items-center justify-center gap-3 animate-in fade-in h-full">
            <span className="text-[10px] font-mono text-red-400 uppercase tracking-wider whitespace-nowrap">
                Delete section {measureIndex + 1}?
            </span>
            <button
                onClick={(e) => { e.stopPropagation(); onConfirm(); }}
                className="text-[10px] font-mono font-bold text-red-500 hover:text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 px-2.5 py-0.5 transition-all uppercase tracking-wider"
            >
                Yes
            </button>
            <button
                onClick={(e) => { e.stopPropagation(); onCancel(); }}
                className="text-[10px] font-mono text-fg-muted hover:text-fg-secondary bg-highlight/5 hover:bg-highlight/10 border border-highlight/10 px-2.5 py-0.5 transition-all uppercase tracking-wider"
            >
                No
            </button>
        </div>
    );
}
