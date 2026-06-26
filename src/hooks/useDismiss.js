// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { useEffect, useRef } from 'react';

/**
 * While `isOpen`, close an overlay on Escape or an outside (mousedown) click.
 * Shared by the toolbar popovers (HumanizeButton, DrumKitButton).
 *
 * `onClose` is read through a ref so passing a fresh inline closure each render
 * doesn't re-subscribe the listeners — the effect only re-runs when `isOpen`
 * flips, matching the original hand-rolled version.
 *
 * @param {boolean} isOpen
 * @param {{ current: HTMLElement | null }} ref  wrapper whose inside is "safe"
 * @param {() => void} onClose
 */
export function useDismiss(isOpen, ref, onClose) {
    const onCloseRef = useRef(onClose);
    useEffect(() => { onCloseRef.current = onClose; });

    useEffect(() => {
        if (!isOpen) return undefined;
        const onKey = (e) => { if (e.key === "Escape") onCloseRef.current(); };
        const onDown = (e) => {
            if (ref.current && !ref.current.contains(e.target)) onCloseRef.current();
        };
        document.addEventListener("keydown", onKey);
        document.addEventListener("mousedown", onDown);
        return () => {
            document.removeEventListener("keydown", onKey);
            document.removeEventListener("mousedown", onDown);
        };
    }, [isOpen, ref]);
}
