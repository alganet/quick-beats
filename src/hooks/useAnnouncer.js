// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { useState, useCallback } from 'react';

// A single shared screen-reader announcer. Status changes that aren't tied to a
// focus move (a kit finishing loading, a measure being added, humanize turning
// on) are invisible to assistive tech unless pushed through a live region
// (WCAG 4.1.3). Rather than a region per component, callers funnel messages
// here and App renders the two live nodes once.
//
//   announce(text)      -> polite region (role="status"): waits its turn,
//                          for confirmations that shouldn't interrupt.
//   announceError(text) -> assertive region (role="alert"): interrupts, for
//                          failures the user needs to know about now.
// A live region only speaks when its DOM changes, so announcing the same text
// twice in a row ("Measure 1 removed", then deleting the new measure 1) would
// be silent the second time. Alternate a trailing no-break space onto repeats:
// invisible, unspoken, but a real mutation.
// (An empty text means "clear the region" — clearing never needs a retrigger.)
const retrigger = (prev, text) => (text && prev === text ? text + '\u00A0' : text);

export function useAnnouncer() {
    const [polite, setPolite] = useState('');
    const [assertive, setAssertive] = useState('');

    const announce = useCallback((text) => setPolite((prev) => retrigger(prev, text ?? '')), []);
    const announceError = useCallback((text) => setAssertive((prev) => retrigger(prev, text ?? '')), []);

    return { polite, assertive, announce, announceError };
}
