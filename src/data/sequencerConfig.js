// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

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

export const INSTRUMENT_ICONS = {
    "Kick": "kick",
    "Snare": "snare",
    "Hi-Hat Closed": "hihat-closed",
    "Hi-Hat Open": "hihat-open",
    "Tom": "tom",
    "Crash": "crash",
    "Ride": "ride"
};
