// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { useCallback, useState } from 'react';
import { GRID_LAYOUT } from '../utils/sequencerGeometry';
import { useMediaQuery } from './useMediaQuery';

const DISMISS_KEY = 'qb-portrait-nudge';

// One query covers every condition, so there's nothing to keep in sync:
// (pointer: coarse) keeps the nudge off desktop windows that merely happen to be
// tall and narrow, and the max-width keeps it off portrait tablets, which
// already show plenty of steps. Reusing the grid's own breakpoint means the two
// definitions of "too narrow" can't drift apart.
const QUERY = `(orientation: portrait) and (pointer: coarse) and (max-width: ${GRID_LAYOUT.mobileBreakpoint - 0.02}px)`;

const wasDismissed = () => {
    try {
        return localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
        return false;
    }
};

export function usePortraitNudge() {
    const cramped = useMediaQuery(QUERY);
    const [dismissed, setDismissed] = useState(wasDismissed);

    const dismiss = useCallback(() => {
        setDismissed(true);
        try {
            localStorage.setItem(DISMISS_KEY, '1');
        } catch {
            // Private mode or a full quota: the nudge stays dismissed for this
            // session, which is the part that matters.
        }
    }, []);

    return { visible: cramped && !dismissed, dismiss };
}
