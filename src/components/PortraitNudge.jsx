// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { Icon } from './Icons';

/**
 * Non-blocking hint that the sequencer has more room in landscape. The grid
 * scrolls horizontally and works fine in portrait, so this never covers it and
 * never gates access — it sits below the content as a bar.
 *
 * `canRotate` is false wherever the rotation can't actually be performed (all of
 * iOS), and there the bar degrades to text asking the user to turn the device.
 */
export default function PortraitNudge({ canRotate, onRotate, onDismiss }) {
    return (
        <div className="flex-none flex items-center gap-3 px-3 py-2 bg-surface-2 border-t border-border-default">
            <Icon id="rotate" className="w-4 h-4 text-accent flex-none" />
            <p className="flex-1 min-w-0 text-fg-muted text-[11px] font-mono uppercase tracking-wide">
                {canRotate ? 'More room in landscape' : 'Turn your device sideways for more room'}
            </p>
            {canRotate && (
                <button
                    onClick={onRotate}
                    className="h-6 px-2 flex-none flex items-center border border-border-default text-[11px] font-bold font-mono text-fg-muted hover:text-fg uppercase tracking-wide transition-colors"
                >
                    Rotate
                </button>
            )}
            {/* h-6 w-6 rather than padding around the glyph: the × is narrow, and
                sizing to it left the target under the 24px WCAG 2.5.8 minimum. */}
            <button
                onClick={onDismiss}
                className="h-6 w-6 flex-none flex items-center justify-center text-fg-muted hover:text-fg transition-colors leading-none"
                aria-label="Dismiss landscape hint"
            >
                <span className="text-2xl">&times;</span>
            </button>
        </div>
    );
}
