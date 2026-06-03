// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

// The single humanization "feel" applied when Humanize is on. Pure playback-time
// scalars shaping the model's raw per-hit output (velocity + microtiming).
// Precomputed off the audio thread (see useAudio's buildAppliedLayer); the loop
// just reads the result. Tune by ear.
//
//   timing   0..1  scale on the model's microtiming offset (0 = snap to grid)
//   velocity 0..1  blend the model's dynamics toward flat (0 = every hit full)

export const HUMANIZE_STYLE = {
    timing: 0.7,
    velocity: 0.85,
};
