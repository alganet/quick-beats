// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

// The URL hash carries two things: the shareable beat (encoded by hashState.js)
// and, optionally, a named overlay (an open modal). This module is the thin,
// pure codec that layers an overlay *around* the beat token without ever
// reinterpreting it — the beat string is still produced/consumed by
// buildShareHash / parseInitialHash in hashState.js.
//
// Grammar (all examples minus the leading '#'):
//   ''                              setup, no overlay
//   120|4/4|black-pearl|16.AAAA|v1  legacy/default beat (Sequencer) — UNCHANGED
//   help~120|4/4|...|v1             beat + Help open
//   share~120|4/4|...|v1            beat + Share open
//   help                            Help open with no beat (on the setup screen)
//
// '~' is an RFC 3986 unreserved character (never percent-encoded) and can never
// appear inside a beat token — beats use digits, '|', '/', '.', and base64url
// (A-Za-z0-9-_) — so it is a safe, invisible separator.

// The extensibility point: a new named screen feature adds one keyword here and
// renders a modal keyed on it. parse/build/history are all generic over this set.
export const OVERLAYS = ['help', 'share'];

const isOverlay = (token) => OVERLAYS.includes(token);

// Split a raw hash (with or without a leading '#') into its overlay and beat
// parts. Detection is structural and unambiguous: a legacy beat always begins
// with a numeric bpm, so a leading overlay keyword or '~' can never collide with
// an already-posted link. Anything unrecognised degrades to "no overlay, treat
// the whole thing as a beat", which then either decodes or is safely ignored.
export const parseRoute = (hash) => {
    const raw = (hash ?? '').startsWith('#') ? hash.substring(1) : (hash ?? '');
    if (!raw) return { overlay: 'none', beat: null };

    const tilde = raw.indexOf('~');
    if (tilde !== -1) {
        const head = raw.substring(0, tilde);
        const rest = raw.substring(tilde + 1);
        if (isOverlay(head)) return { overlay: head, beat: rest || null };
        return { overlay: 'none', beat: raw };
    }

    // No '~': a digit-first string is a legacy/plain beat; a bare keyword is an
    // overlay with no beat; anything else is treated as a (probably invalid) beat.
    if (/^\d/.test(raw)) return { overlay: 'none', beat: raw };
    if (isOverlay(raw)) return { overlay: raw, beat: null };
    return { overlay: 'none', beat: raw };
};

// Inverse of parseRoute. The invariant that anchors backward compatibility:
//   buildRoute({ overlay: 'none', beat }) === beat
// so a beat-only URL is byte-identical to what the app has always produced.
// Returns the hash body WITHOUT a leading '#'.
export const buildRoute = ({ overlay, beat }) => {
    if (!overlay || overlay === 'none') return beat ?? '';
    return beat ? `${overlay}~${beat}` : overlay;
};
