// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { memo, useRef, useCallback } from 'react';
import { useLongPress } from '../hooks/useLongPress';
import { Icon } from './Icons';

export const Pad = ({ isActive, humanized, instrument, rowIdx, colIdx, grouping, config, toggleStep, setMenuState, faded, isFocused, onFocusCell }) => {
    const padRef = useRef(null);

    const onLongPress = useCallback(() => {
        const rect = padRef.current.getBoundingClientRect();
        setMenuState({
            isOpen: true,
            x: rect.left + rect.width / 2,
            y: rect.top,
            row: rowIdx,
            col: colIdx,
            activeOption: null,
            source: 'pointer'
        });
    }, [rowIdx, colIdx, setMenuState]);

    const onClick = useCallback(() => {
        toggleStep(rowIdx, colIdx);
    }, [rowIdx, colIdx, toggleStep]);

    const [longPressHandlers] = useLongPress({ onLongPress, onClick });

    // The cell is the grid structure (column position, layout); the inner box
    // is the actual toggle widget a screen reader/keyboard interacts with.
    const label = `${instrument ? `${instrument}, ` : ''}step ${colIdx + 1}${humanized ? ', humanized' : ''}`;

    return (
        <div
            role="gridcell"
            aria-colindex={colIdx + 1}
            className={`flex-none ${faded ? 'opacity-30 pointer-events-none' : ''}`}
            style={{
                width: `${config.cellWidth}px`,
                marginRight: (colIdx + 1) % grouping === 0 ? `${config.groupGap}px` : undefined,
            }}
        >
            {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events --
                keyboard activation is delegated to the grid container (Sequencer),
                which handles Enter/Space for the focused pad; the onClick below
                only catches the synthesized (detail 0) clicks screen readers send
                instead of key events. */}
            <div
                ref={padRef}
                role="checkbox"
                aria-checked={isActive}
                aria-label={label}
                tabIndex={isFocused ? 0 : -1}
                onFocus={() => onFocusCell?.(rowIdx, colIdx)}
                data-row={rowIdx}
                data-col={colIdx}
                // detail === 0 means a click no pointer produced: screen readers
                // (VoiceOver, NVDA browse mode) activate a checkbox with a
                // synthesized click that useLongPress's mousedown/mouseup pair
                // never sees. Real pointer clicks arrive with detail ≥ 1 and are
                // handled by the long-press path, so this cannot double-fire.
                onClick={(e) => { if (e.detail === 0) toggleStep(rowIdx, colIdx); }}
                {...longPressHandlers}
                className={`pad w-full h-full cursor-pointer touch-pan-x relative ${config.radiusClass}
                    ${isActive
                        ? (humanized ? "bg-accent" : "bg-primary")
                        : "bg-surface-5 hover:bg-border-medium border border-border-bright"}
                `}
                data-testid="pad"
            >
                {/* Non-colour cue: humanized and plain-active pads share a hue
                    axis a greyscale display or colour-vision deficiency can't
                    separate, so humanized pads carry a corner humanize glyph.
                    Sized to the pad and pinned bottom-right; aria-hidden since
                    the label already says ", humanized". */}
                {isActive && humanized && (
                    <Icon
                        id="humanize"
                        className="pointer-events-none absolute bottom-0 right-0 w-[45%] h-[45%] text-accent-mark"
                    />
                )}
            </div>
        </div>
    );
};

export default memo(Pad);
