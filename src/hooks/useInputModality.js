// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { useEffect, useRef } from 'react';

/**
 * Tracks whether the user's most recent interaction was keyboard- or pointer-
 * driven — the same heuristic the platform uses for `:focus-visible`. Returns a
 * ref whose `.current` is `'keyboard' | 'pointer'`.
 *
 * Read it at focus time to tell how a control was focused (Tab/arrow vs click),
 * e.g. to decide whether Space should activate the focused control or fall
 * through to a global shortcut.
 */
export function useInputModality() {
    const modalityRef = useRef('keyboard');

    useEffect(() => {
        const setKeyboard = () => { modalityRef.current = 'keyboard'; };
        const setPointer = () => { modalityRef.current = 'pointer'; };

        // Capture phase so the modality is set before focus handlers read it.
        document.addEventListener('keydown', setKeyboard, true);
        document.addEventListener('pointerdown', setPointer, true);
        document.addEventListener('mousedown', setPointer, true);
        document.addEventListener('touchstart', setPointer, true);

        return () => {
            document.removeEventListener('keydown', setKeyboard, true);
            document.removeEventListener('pointerdown', setPointer, true);
            document.removeEventListener('mousedown', setPointer, true);
            document.removeEventListener('touchstart', setPointer, true);
        };
    }, []);

    return modalityRef;
}
