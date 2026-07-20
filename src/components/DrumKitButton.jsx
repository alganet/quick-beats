// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { useRef, useState } from "react";
import { Icon } from "./Icons";
import ProgressRing from "./ProgressRing";
import { useDismiss } from "../hooks/useDismiss";

/**
 * Drum-kit switcher. A toolbar button that opens a popover listing every kit.
 * Picking one starts an on-demand, gapless switch (the engine swaps only once
 * the new samples are loaded); progress shows unobtrusively as a ring on the
 * button and a spinner on the loading row — mirroring the Humanize feature.
 *
 * props:
 *   kits        - the KITS registry: { [id]: { name, samples } }
 *   activeKit   - id of the kit the engine is currently playing
 *   switchingTo - id of a kit being loaded (null when idle)
 *   progress    - 0..1 download progress for the in-flight switch
 *   onSelectKit - (kitId) => void; requests a switch
 *   menuClassName  - horizontal anchoring for the popover. The default hangs it
 *                    off the button's right edge, which is what fits when the
 *                    button sits centred or near the right of its container.
 *                    Callers that place the button hard against the left edge
 *                    must flip it, or the 12rem popover opens off-screen.
 *   arrowClassName - anchoring for the little pointer; keep it on the same side.
 */
export default function DrumKitButton({
    kits = {}, activeKit, switchingTo, progress = 0, onSelectKit,
    menuClassName = "right-0", arrowClassName = "right-3",
}) {
    const [open, setOpen] = useState(false);
    const wrapperRef = useRef(null);
    const switching = Boolean(switchingTo);
    const activeName = kits[activeKit]?.name ?? "Drum kit";
    const switchingName = kits[switchingTo]?.name ?? "kit";

    useDismiss(open, wrapperRef, () => setOpen(false));

    return (
        <div className="relative flex-none" ref={wrapperRef}>
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-haspopup="menu"
                aria-expanded={open}
                aria-busy={switching || undefined}
                aria-label={switching ? `Loading ${switchingName}` : `Drum kit: ${activeName}`}
                title={switching ? `Loading ${switchingName}…` : `Drum sounds: ${activeName}`}
                className={`w-8 h-8 flex items-center rounded-sm justify-center transition-all ${open
                    ? "bg-surface-inverted text-fg-on-inverted shadow-[0_0_12px_color-mix(in_srgb,var(--color-highlight)_30%,transparent)]"
                    : "bg-surface-5 text-fg-muted hover:text-fg-secondary"
                    }`}
            >
                {switching
                    ? <ProgressRing progress={progress}><Icon id="kit" className="w-3 h-3 text-fg-muted" /></ProgressRing>
                    : <Icon id="kit" className="w-4 h-4" />}
            </button>

            {open && (
                <div
                    role="menu"
                    className={`absolute top-full ${menuClassName} mt-2 w-48 z-[100] bg-surface-3 border border-border-default rounded-sm p-1 text-xs text-fg-secondary shadow-lg`}
                >
                    <div className={`absolute -top-1 ${arrowClassName} w-2 h-2 bg-surface-3 border-l border-t border-border-default rotate-45`} />
                    <div className="px-2 py-1 text-[11px] font-mono uppercase tracking-wider text-fg-muted">Drum sounds</div>
                    {Object.entries(kits).map(([id, kit]) => {
                        const isActive = id === activeKit;
                        const isLoading = id === switchingTo;
                        return (
                            <button
                                key={id}
                                type="button"
                                role="menuitemradio"
                                aria-checked={isActive}
                                disabled={isLoading}
                                onClick={() => onSelectKit(id)}
                                className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-sm text-left transition-colors ${isActive
                                    ? "text-fg"
                                    : "text-fg-secondary hover:text-fg hover:bg-surface-4"
                                    }`}
                            >
                                <span className="flex items-center gap-2">
                                    <Icon id="kit" className="w-3.5 h-3.5" />
                                    {kit.name}
                                </span>
                                {isLoading
                                    ? <Icon id="spinner" className="w-3.5 h-3.5 animate-spin text-fg-muted" />
                                    : isActive
                                        ? <span className="w-1.5 h-1.5 rounded-full bg-accent" aria-hidden="true" />
                                        : null}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
