// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

// Small ring that fills clockwise with `progress` (0..1), wrapping whatever icon
// is passed as children while something downloads. r=15 in a 36-box -> circumference
// ~94.2. Shared by HumanizeButton (model download) and DrumKitButton (kit switch).
const RING_CIRC = 2 * Math.PI * 15;

export default function ProgressRing({ progress, children }) {
    // Coerce, then check finiteness: Math.max/Math.min pass NaN straight
    // through, so an undefined or divide-by-zero progress would reach the DOM as
    // stroke-dasharray="NaN 94.2" — invalid SVG, and the ring vanishes instead
    // of showing an empty state. Number() first rather than Number.isFinite on
    // the raw prop, so a numeric string still renders the arc it used to.
    const n = Number(progress);
    const p = Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
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
            {children}
        </span>
    );
}
