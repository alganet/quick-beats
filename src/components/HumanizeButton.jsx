// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icons";

const POPOVER_COPY = {
    unavailable: "Humanize works on 16th-note grids (4/4, 3/4, 5/4). It's off for this time signature.",
    error: "Couldn't load the humanize model. Check your connection, then retry.",
};

// Small ring that fills clockwise with `progress` (0..1), wrapping the humanize
// icon while the model downloads. r=15 in a 36-box -> circumference ~94.2.
const RING_CIRC = 2 * Math.PI * 15;

function ProgressRing({ progress }) {
    const p = Math.max(0, Math.min(1, progress));
    return (
        <span className="relative w-6 h-6 grid place-items-center">
            <svg viewBox="0 0 36 36" className="absolute inset-0 w-full h-full -rotate-90">
                <circle cx="18" cy="18" r="15" fill="none" strokeWidth="3" className="stroke-surface-3" />
                <circle
                    cx="18" cy="18" r="15" fill="none" strokeWidth="3" strokeLinecap="round"
                    className="stroke-primary transition-[stroke-dasharray] duration-200 ease-out"
                    strokeDasharray={`${p * RING_CIRC} ${RING_CIRC}`}
                />
            </svg>
            <Icon id="humanize" className="w-3 h-3 text-fg-muted" />
        </span>
    );
}

const TITLES = {
    off: "Humanize the beat",
    on: "Humanized — click to turn off",
    pending: "Grid changed — re-humanizing shortly",
    computing: "Humanizing…",
};

/**
 * The Humanize toggle. Clicking flips it on/off:
 *   off      -> turn on (humanizes; spinner while the first run computes)
 *   on        -> turn off (stops humanizing; the last layer is remembered)
 *   pending   -> still on; the grid changed and an auto re-humanize is queued
 *                (shows a "!" until it catches up). Clicking still turns off.
 * Plus blocked states with an explanatory popover: error (with Retry) and
 * unavailable (incompatible time signature).
 *
 * props:
 *   status   - 'off' | 'on' | 'pending' | 'computing' | 'error' | 'unavailable' | 'loading'
 *   progress - 0..1 model-download progress (only used by 'loading')
 *   onClick  - toggle on/off (or retry from the error popover)
 */
export default function HumanizeButton({ status, progress = 0, onClick }) {
    const [popoverOpen, setPopoverOpen] = useState(false);
    const wrapperRef = useRef(null);

    const loading = status === "loading";
    const blocked = status === "unavailable" || status === "error" || loading;
    const active = status === "on" || status === "pending" || status === "computing";
    const computing = status === "computing";
    const pending = status === "pending";
    const pct = Math.round(Math.max(0, Math.min(1, progress)) * 100);

    useEffect(() => {
        if (!popoverOpen) return undefined;
        const onKey = (e) => { if (e.key === "Escape") setPopoverOpen(false); };
        const onDown = (e) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setPopoverOpen(false);
        };
        document.addEventListener("keydown", onKey);
        document.addEventListener("mousedown", onDown);
        return () => {
            document.removeEventListener("keydown", onKey);
            document.removeEventListener("mousedown", onDown);
        };
    }, [popoverOpen]);

    if (blocked) {
        const popoverText = loading
            ? `Getting the humanize model ready — this only happens once. ${pct}%`
            : POPOVER_COPY[status];
        const ariaLabel = loading
            ? `Humanize model loading, ${pct} percent`
            : "Humanization unavailable. Show details.";
        return (
            <div
                className="relative flex-none"
                ref={wrapperRef}
                // Hover-to-open only for the loading popover (per the spec); the
                // unavailable/error popovers stay click/focus-only as before.
                onMouseEnter={loading ? () => setPopoverOpen(true) : undefined}
                onMouseLeave={loading ? () => setPopoverOpen(false) : undefined}
            >
                <button
                    type="button"
                    onClick={() => setPopoverOpen((o) => !o)}
                    onFocus={() => setPopoverOpen(true)}
                    className="w-8 h-8 flex items-center rounded-sm justify-center bg-surface-5"
                    aria-disabled="true"
                    aria-busy={loading || undefined}
                    aria-label={ariaLabel}
                    aria-describedby={popoverOpen ? "humanize-popover" : undefined}
                >
                    {loading
                        ? <ProgressRing progress={progress} />
                        : <Icon id="humanize" className="w-4 h-4 text-fg-muted opacity-30" />}
                </button>
                {popoverOpen && (
                    <div
                        id="humanize-popover"
                        role="tooltip"
                        className="absolute top-full right-0 mt-2 w-56 z-[100] bg-surface-3 border border-border-default rounded-sm p-3 text-xs text-fg-secondary shadow-lg animate-in fade-in duration-150"
                    >
                        <div className="absolute -top-1 right-3 w-2 h-2 bg-surface-3 border-l border-t border-border-default rotate-45" />
                        <p>{popoverText}</p>
                        {status === "error" && (
                            <button
                                onClick={() => { setPopoverOpen(false); onClick(); }}
                                className="mt-2 px-2 py-1 rounded-sm bg-surface-5 text-fg hover:bg-border-medium"
                            >
                                Retry
                            </button>
                        )}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="relative flex-none">
            <button
                type="button"
                onClick={onClick}
                aria-pressed={active}
                aria-busy={computing || undefined}
                className={`relative w-8 h-8 grid place-items-center rounded-sm transition-all ${active
                    ? "bg-surface-inverted text-fg-on-inverted shadow-[0_0_12px_color-mix(in_srgb,var(--color-highlight)_30%,transparent)]"
                    : "bg-surface-5 text-fg-muted hover:text-fg-secondary"
                    }`}
                title={TITLES[status] ?? TITLES.off}
                aria-label="Humanize"
            >
                <Icon id={computing ? "spinner" : "humanize"} className={`w-4 h-4 ${computing ? "animate-spin" : ""}`} />
                {pending && (
                    <span
                        aria-hidden="true"
                        className="absolute -top-1 -right-1 w-3 h-3 flex items-center justify-center rounded-full bg-surface-0 text-fg text-[9px] font-bold leading-none"
                    >
                        !
                    </span>
                )}
            </button>
        </div>
    );
}
