// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { useEffect, useState } from 'react';
import { IconSprite, Icon } from './Icons';

const ANTI_FLASH_MS = 150;

/**
 * Brief branded loading screen shown while the drum samples warm into the HTTP
 * cache, before any UX. The content stays invisible for a short delay so fast
 * connections (loader unmounted in well under the delay) never see a flash.
 *
 * props:
 *   progress - 0..1 sample-prefetch progress for the bar.
 */
export default function LoadingScreen({ progress = 0 }) {
    const pct = Math.round(Math.max(0, Math.min(1, progress)) * 100);
    const [shown, setShown] = useState(false);

    useEffect(() => {
        const t = setTimeout(() => setShown(true), ANTI_FLASH_MS);
        return () => clearTimeout(t);
    }, []);

    return (
        <div
            role="status"
            aria-live="polite"
            aria-label={`Loading sounds, ${pct} percent`}
            className="min-h-dvh w-full flex flex-col items-center justify-center bg-surface-0 p-6"
        >
            <IconSprite />
            {/* Anti-flash: stay invisible until the delay passes so a loader that
                unmounts quickly is never visibly painted. */}
            <div className={`flex flex-col items-center transition-opacity duration-300 ${shown ? 'opacity-100' : 'opacity-0'}`}>
                <h1 className="text-3xl font-black tracking-tighter text-fg mb-4 uppercase flex items-center justify-center gap-3">
                    <Icon id="logo" className="w-12 h-12" />
                    Quick Beats
                </h1>
                <p className="text-fg-muted text-sm font-mono uppercase tracking-[0.2em] mb-6">
                    Loading sounds…
                </p>
                <div className="w-56 h-1 bg-surface-3 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-primary transition-[width] duration-200 ease-out"
                        style={{ width: `${pct}%` }}
                    />
                </div>
            </div>
        </div>
    );
}
