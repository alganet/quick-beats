// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

export const KITS = {
    "black-pearl": {
        name: "Black Pearl",
        samples: {
            Kick: "/samples/BLACK_PEARL_2023_repack/36-Pearl-22-Kick-1.wav",
            Snare: "/samples/BLACK_PEARL_2023_repack/38-Pearl-14-Snare-1.wav",
            "Hi-Hat Closed": "/samples/BLACK_PEARL_2023_repack/42-Sabian-13-HatClosed-1.wav",
            "Hi-Hat Open": "/samples/BLACK_PEARL_2023_repack/46-Sabian-13-HatSemi-1.wav",
            Tom: "/samples/BLACK_PEARL_2023_repack/45-Pearl-12-Tom-1.wav",
            Crash: "/samples/BLACK_PEARL_2023_repack/49-SabianAA-16-Crash-1.wav",
            Ride: "/samples/BLACK_PEARL_2023_repack/51-SabianAAX-20-Ride-1.wav",
        }
    }
};

// For backward compatibility while refactoring
export const KIT = KITS["black-pearl"].samples;
export const INSTRUMENTS = Object.keys(KIT);
export const DEFAULT_KIT_ID = "black-pearl";
