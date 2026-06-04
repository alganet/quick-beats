// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

// Warms the HTTP cache with a kit's drum samples so the first play (or Setup
// preview) decodes from cache instead of stalling on a cold network fetch.
// Deliberately does NOT create any Tone nodes or an AudioContext — that stays
// deferred to the first user gesture (see useAudio) to avoid the autoplay
// console warning. We just download the bytes.

import { KITS } from '../data/kit';

/**
 * Prefetch every sample of `kitId` into the browser's HTTP cache. Resolves once
 * all requests settle; never rejects (a failed file just doesn't get cached —
 * Tone's own fetch on first play is the fallback).
 *
 * @param {string} kitId
 * @param {(progress: number) => void} [onProgress] called with 0..1 as files complete.
 */
export const prefetchKitSamples = async (kitId, onProgress) => {
    const kit = KITS[kitId];
    if (!kit) {
        onProgress?.(1);
        return;
    }

    const base = import.meta.env?.BASE_URL ?? '/';
    const urls = Object.values(kit.samples).map((path) => {
        const cleanPath = path.startsWith('/') ? path.slice(1) : path;
        return `${base}${cleanPath}`;
    });

    const total = urls.length;
    if (total === 0) {
        onProgress?.(1);
        return;
    }

    let done = 0;
    onProgress?.(0);
    await Promise.all(
        urls.map(async (url) => {
            try {
                // Consume the body so the response fully lands in cache, then drop it.
                await (await fetch(url)).blob();
            } catch {
                // Swallow — first play falls back to Tone's own fetch.
            }
            done += 1;
            onProgress?.(done / total);
        }),
    );
};
