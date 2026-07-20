// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

// The zoom a fresh visitor lands on, and the ceiling auto-fit will pick up to.
export const DEFAULT_ZOOM = 1;

// The tempo range the transport is willing to run at. Lives here rather than in
// Controls.jsx because the share-link decoder has to clamp to the same bounds:
// a hash carrying bpm 0 used to reach rescaleOffsets as a divisor and produce
// Infinity microtiming offsets.
export const MIN_BPM = 60;
export const MAX_BPM = 240;

// One clamp, so the tempo control and the share-link decoder can never disagree
// about what an in-range tempo is.
export const clampBpm = (value) => Math.max(MIN_BPM, Math.min(MAX_BPM, value));

// Ceiling on the step count a share link may decode to. cols arrives from an
// untrusted URL and drives the decode loop, so without a bound a hand-edited
// link allocates an arbitrarily large grid (2,000,000 columns is a few hundred
// milliseconds and hundreds of MB; larger just hangs the tab).
//
// 512 is the ceiling humanization already imposes — MAX_WINDOWS * WINDOW_STEPS
// in grooveConvert — and is ~32 bars of 4/4, well past anything the UI can build
// by hand. Deriving it by import would invert the layering (data importing
// utils), so the two are pinned equal by a test in grooveConvert.test.js instead
// of by a comment nothing enforces.
export const MAX_GRID_COLS = 512;

export const ZOOM_CONFIG = {
    0: { // Small
        cellWidth: 20, // w-5
        gap: 2,        // gap-0.5
        groupGap: 6,   // mr-1.5
        cellHeight: 28, // h-7
        cellClass: 'w-5',
        heightClass: 'h-7',
        gapClass: 'gap-0.5',
        groupGapClass: 'mr-1.5',
        radiusClass: 'rounded-sm'
    },
    1: { // Medium
        cellWidth: 32, // w-8
        gap: 4,        // gap-1
        groupGap: 12,  // mr-3
        cellHeight: 40, // h-10
        cellClass: 'w-8',
        heightClass: 'h-10',
        gapClass: 'gap-1',
        groupGapClass: 'mr-3',
        radiusClass: 'rounded-md'
    },
    2: { // Large
        cellWidth: 40, // w-10
        gap: 4,        // gap-1
        groupGap: 16,  // mr-4
        cellHeight: 48, // h-12
        cellClass: 'w-10',
        heightClass: 'h-12',
        gapClass: 'gap-1',
        groupGapClass: 'mr-4',
        radiusClass: 'rounded-md'
    }
};

/**
 * Coerce a persisted or foreign zoom into one this build actually renders.
 *
 * Several call sites index ZOOM_CONFIG raw and read a field straight off the
 * result, so a value we never wrote — a stale level from a build with more
 * zooms, or a hand-edited key — would otherwise blank the app with no way back
 * short of clearing site data. Anything unrecognised becomes the default, which
 * the persist effect then writes back over the bad value.
 */
export function normalizeZoom(value) {
    const zoom = typeof value === 'number' ? value : parseInt(value, 10);
    return ZOOM_CONFIG[zoom] ? zoom : DEFAULT_ZOOM;
}

// Bulk-fill modes, in menu order. Single source of truth shared by the menu
// render (ContextMenu) and the keyboard cycling (useSequencerSelection).
export const FILL_MODES = ['repeat', 'alternate', 'clear'];

export const INSTRUMENT_ICONS = {
    "Kick": "kick",
    "Snare": "snare",
    "Hi-Hat Closed": "hihat-closed",
    "Hi-Hat Open": "hihat-open",
    "Tom": "tom",
    "Crash": "crash",
    "Ride": "ride"
};
