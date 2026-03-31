// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { memo, useRef, useCallback } from 'react';
import { useLongPress } from '../hooks/useLongPress';

export const Pad = ({ isActive, rowIdx, colIdx, grouping, config, toggleStep, setMenuState, faded }) => {
    const padRef = useRef(null);

    const onLongPress = useCallback(() => {
        const rect = padRef.current.getBoundingClientRect();
        setMenuState({
            isOpen: true,
            x: rect.left + rect.width / 2,
            y: rect.top,
            row: rowIdx,
            col: colIdx,
            activeOption: null
        });
    }, [rowIdx, colIdx, setMenuState]);

    const onClick = useCallback(() => {
        toggleStep(rowIdx, colIdx);
    }, [rowIdx, colIdx, toggleStep]);

    const [longPressHandlers] = useLongPress({ onLongPress, onClick });

    return (
        <div
            ref={padRef}
            {...longPressHandlers}
            className={`flex-none cursor-pointer touch-pan-x relative ${config.radiusClass}
                ${isActive
                    ? "bg-primary"
                    : "bg-surface-5 hover:bg-border-medium"}
                ${faded ? 'opacity-30 pointer-events-none' : ''}
            `}
            style={{
                width: `${config.cellWidth}px`,
                marginRight: (colIdx + 1) % grouping === 0 ? `${config.groupGap}px` : undefined,
            }}
            data-testid="pad"
        >
        </div>
    );
};

export default memo(Pad);
