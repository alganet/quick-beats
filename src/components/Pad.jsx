// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { memo, useRef, useCallback } from 'react';
import { useLongPress } from '../hooks/useLongPress';

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
            <div
                ref={padRef}
                role="checkbox"
                aria-checked={isActive}
                aria-label={label}
                tabIndex={isFocused ? 0 : -1}
                onFocus={() => onFocusCell?.(rowIdx, colIdx)}
                data-row={rowIdx}
                data-col={colIdx}
                {...longPressHandlers}
                className={`w-full h-full cursor-pointer touch-pan-x relative ${config.radiusClass}
                    ${isActive
                        ? (humanized ? "bg-accent" : "bg-primary")
                        : "bg-surface-5 hover:bg-border-medium"}
                `}
                data-testid="pad"
            >
            </div>
        </div>
    );
};

export default memo(Pad);
