// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { clampBpm, MAX_GRID_COLS } from '../data/sequencerConfig';

export const encodeGrid = (grid) => {
    if (!grid || !grid.length) return "";
    const rows = grid.length;
    const cols = grid[0].length;

    // Flatten the grid into a single bitstring
    let binary = "";
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            binary += grid[r][c] ? "1" : "0";
        }
    }

    // Padding to make it multiple of 8
    const padding = (8 - (binary.length % 8)) % 8;
    binary += "0".repeat(padding);

    // Convert binary to byte array
    const bytes = [];
    for (let i = 0; i < binary.length; i += 8) {
        bytes.push(parseInt(binary.substr(i, 8), 2));
    }

    // Convert to Base64 (URL safe: replacing + with - and / with _)
    const base64 = btoa(String.fromCharCode.apply(null, bytes))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, ''); // Remove padding

    return `${cols}.${base64}`;
};

export const decodeGrid = (encoded, expectedRows) => {
    if (!encoded) return null;
    const [colsStr, base64] = encoded.split('.');
    const cols = parseInt(colsStr);

    // Everything below runs on a string pulled straight out of the URL, so it
    // has to survive being hand-edited or truncated. This guard used to be just
    // the isNaN check, and the `base64.replace` two lines down sat outside the
    // try block: a segment with no '.' at all left base64 undefined and threw a
    // TypeError instead of returning null. App.jsx calls parseInitialHash at
    // module scope, outside React and outside any error boundary, so that threw
    // before anything could catch it — a truncated share link was a white screen.
    if (Number.isNaN(cols) || cols < 1 || cols > MAX_GRID_COLS) return null;
    if (typeof base64 !== 'string' || !base64) return null;

    // Restore Base64
    let b64 = base64.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';

    try {
        const binaryStr = atob(b64);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
        }

        // Convert bytes back to binary string
        let binary = "";
        for (let i = 0; i < bytes.length; i++) {
            binary += bytes[i].toString(2).padStart(8, '0');
        }

        // A payload shorter than the grid it claims to describe is a truncated
        // link. Reading past the end yields `undefined === "1"` — false — so it
        // used to decode as a valid but silently half-empty beat, which looks
        // like the app losing the user's work rather than like a broken URL.
        if (binary.length < expectedRows * cols) return null;

        const grid = [];
        for (let r = 0; r < expectedRows; r++) {
            const row = [];
            for (let c = 0; c < cols; c++) {
                const index = r * cols + c;
                row.push(binary[index] === "1");
            }
            grid.push(row);
        }
        return grid;
    } catch (e) {
        console.error("Failed to decode grid hash", e);
        return null;
    }
};

export const buildShareHash = ({ bpm, sigName, kitId = 'black-pearl', grid }) => {
    const gridHash = encodeGrid(grid);
    // format: bpm|signature|kit|cols.base64|v1
    return `${bpm}|${sigName}|${kitId}|${gridHash}|v1`;
};

export const parseShareHash = (hash, expectedRows) => {
    if (!hash) return null;
    // allow leading '#'
    const raw = hash.startsWith('#') ? hash.substring(1) : hash;
    const parts = raw.split('|');
    if (parts.length < 3) return null; // must contain at least bpm and signature

    const parsedBpm = parseInt(parts[0], 10);
    if (Number.isNaN(parsedBpm)) return null;
    // Clamped rather than rejected: a tempo outside the transport's range is no
    // reason to throw away an otherwise good beat, and the UI clamps to exactly
    // these bounds anyway. bpm 0 in particular reaches rescaleOffsets as a
    // divisor and turns every microtiming offset into Infinity.
    const bpm = clampBpm(parsedBpm);

    const sigName = parts[1];

    let kitId = 'black-pearl';
    let gridData = '';

    // two supported shapes:
    //  - bpm|sig|cols.base64       (legacy/short)
    //  - bpm|sig|cols.base64|v1    (legacy with version)
    //  - bpm|sig|kit|cols.base64   (4-part with kit)
    //  - bpm|sig|kit|cols.base64|v1 (full with version)
    if (parts.length === 3) {
        gridData = parts[2];
    } else if (parts.length >= 4) {
        // When a kit is provided the grid is the next segment. Ignore trailing
        // version segment if present.
        if (parts.length === 4) {
            // Could be bpm|sig|kit|grid or bpm|sig|grid|v1
            // If parts[2] looks like grid data (contains a dot, number.base64),
            // treat as grid format; otherwise treat as kit format.
            if (parts[2].includes('.')) {
                // bpm|sig|grid|v1 (legacy with version)
                gridData = parts[2];
            } else {
                // bpm|sig|kit|grid (4-part with kit)
                kitId = parts[2];
                gridData = parts[3];
            }
        } else {
            kitId = parts[2];
            gridData = parts[3];
        }
    }

    const grid = decodeGrid(gridData, expectedRows);
    if (!grid) return null;

    return { bpm, sigName, kitId, grid };
};

// Parse a share hash into the initial app state for a fresh load: resolve the
// signature name against the known signatures and only accept the hash if it
// names a real one. Returns { success, bpm, sig, kitId, grid } on success, or
// null when there's no usable hash. Kept a pure module-level function (not a
// hook) so it can seed the useState initializers without a setup-screen flash.
export const parseInitialHash = (hash, instrumentCount, signatures) => {
    const parsed = parseShareHash(hash, instrumentCount);
    if (!parsed) return null;

    const sig = signatures.find(s => s.name === parsed.sigName);
    if (!sig) return null;

    return { success: true, bpm: parsed.bpm, sig, kitId: parsed.kitId, grid: parsed.grid };
};
