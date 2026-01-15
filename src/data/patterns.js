// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

export const BACKBEATS = {
    "4/4": {
        tempo: 120,
        rhythm: {
            "Kick": [0, 8],
            "Snare": [4, 12],
            "Hi-Hat Closed": [0, 2, 4, 6, 8, 10, 12, 14]
        }
    },
    "3/4": {
        tempo: 100,
        rhythm: {
            "Kick": [0],
            "Snare": [4, 8],
            "Hi-Hat Closed": [0, 2, 4, 6, 8, 10]
        }
    },
    "6/8": {
        tempo: 80,
        rhythm: {
            "Kick": [0, 6],
            "Snare": [3, 9],
            "Hi-Hat Closed": [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
        }
    },
    "5/4": {
        tempo: 120,
        rhythm: {
            "Kick": [0, 12],
            "Snare": [4, 8, 16],
            "Hi-Hat Closed": [0, 2, 4, 6, 8, 10, 12, 14, 16, 18]
        }
    }
};
