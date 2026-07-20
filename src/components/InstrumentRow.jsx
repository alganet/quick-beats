// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC


import { memo } from 'react';
import { ZOOM_CONFIG, INSTRUMENT_ICONS } from '../data/sequencerConfig';
import { GRID_LAYOUT, sequenceWidth, stepToX } from '../utils/sequencerGeometry';
import { Icon } from './Icons';
import Pad from './Pad';

export function InstrumentRow({
    instrument,
    rowIdx,
    gridRow,
    humanizedRow,
    stepCount,
    stepsPerMeasure,
    grouping,
    toggleStep,
    setMenuState,
    pendingDelete,
    zoom,
    visibleRange,
    focusedCol = -1,
    onFocusCell,
    menuCol = -1
}) {
    const config = ZOOM_CONFIG[zoom];
    const start = visibleRange?.start ?? 0;
    const end = Math.min(stepCount ?? (gridRow?.length ?? 0), visibleRange?.end ?? (gridRow?.length ?? 0));

    const totalWidth = sequenceWidth(stepCount ?? (gridRow?.length ?? 0), grouping, zoom);
    const leftSpacerWidth = stepToX(start, grouping, zoom);
    const windowWidth = stepToX(end, grouping, zoom) - stepToX(start, grouping, zoom);
    const rightSpacerWidth = Math.max(0, totalWidth - leftSpacerWidth - windowWidth);

    return (
        <div data-grid-row="true" role="row" aria-rowindex={rowIdx + 1} className={`flex items-center ${config.heightClass} group hover:bg-highlight/[0.02]`}>
            {/* Sticky Instrument Label - Narrowed for Icons */}
            {/* The sr-only text is the row header's accessible name (reliable
                "name from content"); the icon is decorative and title is just the
                sighted hover tooltip. */}
            <div data-grid-label="true" role="rowheader" aria-colindex={1} className={`sticky left-0 ${GRID_LAYOUT.rowLabelClass} flex-shrink-0 flex items-center justify-center z-20 bg-surface-1 h-full shadow-[2px_0_5px_var(--color-surface-1)]`} title={instrument}>
                <span className="sr-only">{instrument}</span>
                <Icon id={INSTRUMENT_ICONS[instrument] || 'kick'} className="w-5 h-5 text-fg-secondary" aria-hidden="true" />
            </div>
            {/* The lane and window wrappers are presentational so the gridcells
                hoist to be owned directly by the row (windowed render). */}
            <div
                data-grid-lane="true"
                role="presentation"
                className={`flex-1 flex h-full relative ${GRID_LAYOUT.rowLaneClass}`}
                style={{ marginRight: `-${config.groupGap}px` }}
            >
                {leftSpacerWidth > 0 && <div className="flex-none" style={{ width: `${leftSpacerWidth}px` }} aria-hidden="true" />}
                <div role="presentation" className="flex-none flex h-full" style={{ width: `${windowWidth}px`, columnGap: `${config.gap}px` }}>
                {gridRow && gridRow.slice(start, end).map((isActive, offsetIdx) => {
                    const colIdx = start + offsetIdx;
                    const measureIdx = Math.floor(colIdx / stepsPerMeasure);
                    return (
                        <Pad
                            key={colIdx}
                            isActive={isActive}
                            humanized={!!humanizedRow?.[colIdx]}
                            instrument={instrument}
                            rowIdx={rowIdx}
                            colIdx={colIdx}
                            grouping={grouping}
                            config={config}
                            toggleStep={toggleStep}
                            setMenuState={setMenuState}
                            faded={pendingDelete === measureIdx}
                            isFocused={focusedCol === colIdx}
                            onFocusCell={onFocusCell}
                            menuOpen={menuCol === colIdx}
                        />
                    )
                })}
                </div>
                {rightSpacerWidth > 0 && <div className="flex-none" style={{ width: `${rightSpacerWidth}px` }} aria-hidden="true" />}
            </div>
        </div>
    );
}

export const MemoizedInstrumentRow = memo(InstrumentRow);
