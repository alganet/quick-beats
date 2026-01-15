// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

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
    if (isNaN(cols)) return null;

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
