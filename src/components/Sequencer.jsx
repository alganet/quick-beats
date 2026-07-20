// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { INSTRUMENTS } from "../data/kit";
import { ZOOM_CONFIG } from "../data/sequencerConfig";
import { Icon } from "./Icons";
import ContextMenu from "./ContextMenu";
import { useSequencerSelection } from "../hooks/useSequencerSelection";
import { useAutoScroll } from "../hooks/useAutoScroll";
import { useFitZoom } from "../hooks/useFitZoom";
import { SequencerHeader } from "./SequencerHeader";
import { MemoizedInstrumentRow } from "./InstrumentRow";
import { MeasureControls } from "./MeasureControls";
import { PlayheadOverlay } from "./PlayheadOverlay";
import { getGridOriginOffsetPx, isMobileViewport, scrollTargetForStep, xToStep } from "../utils/sequencerGeometry";




export default function Sequencer({ isPlaying, togglePlay, grid, humanizedMask, toggleStep, bulkUpdateStep, currentStep, stepCount = 16, setStep, addMeasure, removeMeasure, beatsPerMeasure = 4, stepsPerBeat = 4, grouping = 4, autoScroll, setAutoScroll, setCanScroll, zoom, fitZoomToHeight = false, onFitZoom }) {
    const scrollContainerRef = useRef(null);
    const [pendingDelete, setPendingDelete] = useState(null);
    const [gridOriginOffset, setGridOriginOffset] = useState(getGridOriginOffsetPx(isMobileViewport()));
    const geometryRef = useRef({
        left: 0,
        scrollLeft: 0,
        gridOriginOffset: getGridOriginOffsetPx(isMobileViewport()),
        containerWidth: 0,
    });
    const [visibleRange, setVisibleRange] = useState({ start: 0, end: stepCount });
    // Single roving tab stop for the grid (the pad at this cell has tabIndex 0,
    // every other pad -1). `navFocusRef` marks a programmatic move so the
    // focus-into-view effect only steals focus on keyboard navigation, never on
    // playback auto-scroll.
    const [focusedCell, setFocusedCell] = useState({ row: 0, col: 0 });
    const navFocusRef = useRef(false);
    // True while focus is inside the grid. Used to keep the focused cell rendered
    // (see renderRange) so a scroll can't window it out and drop focus to <body>.
    const [gridHasFocus, setGridHasFocus] = useState(false);

    const { menuState, setMenuState, menuRef, selectOption, hoverOption } = useSequencerSelection({ onBulkUpdate: bulkUpdateStep });
    
    // Auto-scroll hook
    const { playheadOffRight, playheadOffLeft, handleWheel, handleTouchStart, handleTouchMove } = useAutoScroll({
        scrollContainerRef,
        currentStep,
        stepCount,
        grouping,
        autoScroll,
        setAutoScroll,
        setCanScroll,
        zoom,
        gridOriginOffset
    });

    const stepsPerMeasure = beatsPerMeasure * stepsPerBeat;
    const measureCount = Math.floor(stepCount / stepsPerMeasure);

    // Sizes the grid to the height it has, until the user picks a zoom themselves.
    useFitZoom({
        scrollContainerRef,
        enabled: fitZoomToHeight,
        rowCount: INSTRUMENTS.length,
        measureCount,
        onFit: onFitZoom,
    });

    const updateGeometryAndRange = useCallback(() => {
        const container = scrollContainerRef.current;
        if (!container) return;

        const rect = container.getBoundingClientRect();
        const firstRow = container.querySelector('[data-grid-row="true"]');
        const labelCol = firstRow?.querySelector('[data-grid-label="true"]');
        const lane = firstRow?.querySelector('[data-grid-lane="true"]');
        const fallbackOffset = getGridOriginOffsetPx(isMobileViewport());
        const labelWidth = labelCol?.getBoundingClientRect().width ?? 0;
        const laneStyles = lane ? window.getComputedStyle(lane) : null;
        const laneMarginLeft = laneStyles ? parseFloat(laneStyles.marginLeft || '0') : 0;
        const lanePaddingLeft = laneStyles ? parseFloat(laneStyles.paddingLeft || '0') : 0;
        const measuredOffset = labelCol && lane
            ? Math.round(labelWidth + laneMarginLeft + lanePaddingLeft)
            : fallbackOffset;
        const containerWidth = container.clientWidth;
        const scrollLeft = container.scrollLeft;

        setGridOriginOffset((previous) => (previous === measuredOffset ? previous : measuredOffset));

        geometryRef.current = {
            left: rect.left,
            scrollLeft,
            gridOriginOffset: measuredOffset,
            containerWidth,
        };

        const leftEdge = Math.max(0, scrollLeft - measuredOffset);
        const rightEdge = Math.max(0, scrollLeft + containerWidth - measuredOffset);
        const overscan = 12;
        const start = Math.max(0, xToStep(leftEdge, stepCount, grouping, zoom) - overscan);
        const end = Math.min(stepCount, xToStep(rightEdge, stepCount, grouping, zoom) + overscan + 1);

        setVisibleRange((previous) => (
            previous.start === start && previous.end === end
                ? previous
                : { start, end }
        ));
    }, [grouping, stepCount, zoom]);

    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) return;

        let animationFrameId = null;
        const updateOnScroll = () => {
            if (animationFrameId !== null) return;
            animationFrameId = window.requestAnimationFrame(() => {
                animationFrameId = null;
                updateGeometryAndRange();
            });
        };

        const resizeObserver = new ResizeObserver(() => {
            updateGeometryAndRange();
        });

        resizeObserver.observe(container);
        const labelCol = container.querySelector('.sticky');
        if (labelCol) resizeObserver.observe(labelCol);

        container.addEventListener('scroll', updateOnScroll, { passive: true });
        window.addEventListener('resize', updateGeometryAndRange);
        updateOnScroll();

        return () => {
            if (animationFrameId !== null) {
                window.cancelAnimationFrame(animationFrameId);
            }
            resizeObserver.disconnect();
            container.removeEventListener('scroll', updateOnScroll);
            window.removeEventListener('resize', updateGeometryAndRange);
        };
    }, [updateGeometryAndRange]);

    const calculateStepFromEvent = (e) => {
        const { left, scrollLeft, gridOriginOffset } = geometryRef.current;

        // Click position within the scrollable content
        const x = e.clientX - left + scrollLeft - gridOriginOffset;
        return xToStep(x, stepCount, grouping, zoom);
    };

    // Shared by pointer (click position → step) and keyboard (step directly)
    // seeking, so both stop playback the same way.
    const seekToStep = (newStep) => {
        if (setStep) setStep(newStep);
        // If currently playing, stop playback when the user seeks via header
        if (isPlaying && typeof togglePlay === 'function') togglePlay();
    };

    const handleSeek = (e) => {
        seekToStep(calculateStepFromEvent(e));
    };

    // Keyboard grid navigation -------------------------------------------------
    const rowCount = INSTRUMENTS.length;

    // Clamp the roving focus to the live grid bounds at render time (cheaper and
    // safer than a clamp effect when the grid shrinks — measure removed / sig
    // change). The raw `focusedCell` may briefly hold an out-of-range value;
    // these derived values are what we render and focus with.
    const focusRow = Math.min(focusedCell.row, rowCount - 1);
    const focusCol = Math.min(focusedCell.col, Math.max(0, stepCount - 1));

    // While the grid holds focus, force the focused column into the rendered
    // window so a scroll (wheel, etc.) can't unmount the focused pad and lose
    // focus. When focus is elsewhere, normal windowing applies.
    const renderRange = gridHasFocus
        ? { start: Math.min(visibleRange.start, focusCol), end: Math.max(visibleRange.end, focusCol + 1) }
        : visibleRange;

    // Move the roving focus to a (clamped) cell and flag it for focus-into-view.
    const moveFocus = useCallback((row, col) => {
        const r = Math.max(0, Math.min(rowCount - 1, row));
        const c = Math.max(0, Math.min(stepCount - 1, col));
        navFocusRef.current = true;
        setFocusedCell((prev) => (prev.row === r && prev.col === c ? prev : { row: r, col: c }));
    }, [rowCount, stepCount]);

    // Keep the roving stop in sync when a pad is focused.
    const handleFocusCell = useCallback((row, col) => {
        setFocusedCell((prev) => (prev.row === row && prev.col === col ? prev : { row, col }));
    }, []);

    // Open the bulk-fill menu for a cell from the keyboard (ContextMenu / Shift+F10
    // / m). 'menu' mode takes focus and is arrow- and click-navigable — the same
    // mode a right-click opens.
    const openFillMenu = useCallback((cell, row, col) => {
        const rect = cell.getBoundingClientRect();
        setMenuState({
            isOpen: true,
            x: rect.left + rect.width / 2,
            y: rect.top,
            row,
            col,
            activeOption: 'repeat',
            source: 'menu',
        });
    }, [setMenuState]);

    const handleGridKeyDown = useCallback((e) => {
        if (menuState.isOpen) return; // menu owns the keyboard while open (3c)
        const cell = e.target.closest?.('[data-col]');
        if (!cell) return;
        const row = Number(cell.dataset.row);
        const col = Number(cell.dataset.col);
        // A measure pending deletion is non-interactive (pointer-events-none for
        // the mouse); mirror that for the keyboard — navigation still works, but
        // editing/menu actions are suppressed.
        const faded = pendingDelete === Math.floor(col / stepsPerMeasure);
        // Browser and OS chords (Alt+Left history nav, Ctrl+M, ...) are not ours
        // to hijack; Ctrl only means something on Home/End (jump to first/last row).
        if (e.altKey || e.metaKey) return;
        if (e.ctrlKey && e.key !== 'Home' && e.key !== 'End') return;
        let handled = true;
        switch (e.key) {
            case 'ArrowRight': moveFocus(row, col + 1); break;
            case 'ArrowLeft': moveFocus(row, col - 1); break;
            case 'ArrowDown': moveFocus(row + 1, col); break;
            case 'ArrowUp': moveFocus(row - 1, col); break;
            case 'Home': moveFocus(e.ctrlKey ? 0 : row, 0); break;
            case 'End': moveFocus(e.ctrlKey ? rowCount - 1 : row, stepCount - 1); break;
            case 'Enter':
                if (!faded) toggleStep(row, col);
                break;
            case ' ':
                // Space toggles the focused pad — the ARIA default for its
                // role="checkbox". (Play/pause is `p`, so Space no longer has a
                // second, conflicting meaning here.)
                if (!faded) toggleStep(row, col);
                break;
            case 'ContextMenu':
                if (!faded) openFillMenu(cell, row, col);
                break;
            case 'F10':
                if (e.shiftKey && !faded) openFillMenu(cell, row, col);
                else if (!e.shiftKey) handled = false;
                break;
            // 'm' as a keyboard trigger for keyboards without a dedicated Menu key.
            case 'm':
            case 'M':
                if (!faded) openFillMenu(cell, row, col);
                else handled = false;
                break;
            default: handled = false;
        }
        if (handled) {
            // Stop bubbling so Space doesn't reach App's global play shortcut and
            // arrows don't scroll the page.
            e.preventDefault();
            e.stopPropagation();
        }
    }, [menuState.isOpen, moveFocus, openFillMenu, pendingDelete, rowCount, stepsPerMeasure, stepCount, toggleStep]);

    // A 'menu'-mode fill menu (right-click or keyboard) takes focus, so its
    // role="menu" + aria-activedescendant announce the active option natively; on
    // close, focus returns to the pad it opened from. Only when focus fell to
    // <body> — i.e. the menu unmounted with nothing else grabbing focus (Escape /
    // Enter / click-select) — is it restored; a Tab close moved focus onward, leave it.
    const menuWasMenuOpenRef = useRef(false);
    useEffect(() => {
        const menuOpen = menuState.isOpen && menuState.source === 'menu';
        const wasOpen = menuWasMenuOpenRef.current;
        menuWasMenuOpenRef.current = menuOpen;
        if (menuOpen && !wasOpen) {
            menuRef.current?.focus();
        } else if (!menuOpen && wasOpen && document.activeElement === document.body) {
            // The origin pad can have been windowed out of the DOM (a scroll
            // dismissed the menu); fall back to any rendered pad in its row so
            // keyboard focus never silently drops to <body>.
            const container = scrollContainerRef.current;
            const target = container?.querySelector(`[data-row="${menuState.row}"][data-col="${menuState.col}"]`)
                ?? container?.querySelector(`[data-row="${menuState.row}"][data-col]`);
            target?.focus();
        }
    }, [menuState.isOpen, menuState.source, menuState.row, menuState.col, menuRef]);

    // Focus-into-view: after a keyboard move, focus the target pad. If it's
    // outside the rendered window, scroll it in first and bail — the scroll
    // listener updates visibleRange, which re-runs this effect with the pad now
    // in the DOM.
    useLayoutEffect(() => {
        if (!navFocusRef.current) return;
        const container = scrollContainerRef.current;
        if (!container) return;
        if (focusCol < visibleRange.start || focusCol >= visibleRange.end) {
            const { scrollLeft, containerWidth, gridOriginOffset } = geometryRef.current;
            const target = scrollTargetForStep(focusCol, scrollLeft, containerWidth, gridOriginOffset, grouping, zoom);
            if (target !== null) {
                container.scrollTo({ left: target, behavior: 'auto' });
                return;
            }
        }
        const el = container.querySelector(`[data-row="${focusRow}"][data-col="${focusCol}"]`);
        if (el) {
            el.focus();
            navFocusRef.current = false;
        }
    }, [focusRow, focusCol, visibleRange, grouping, zoom]);

    // Enter the grid on an arrow key when nothing else is focused. Without this
    // the arrows only navigate once you've already clicked or tabbed into a pad;
    // this lets a keyboard user drop straight in. Gated on document.body focus so
    // it never steals arrows from a focused control — and a screen reader in
    // browse mode intercepts arrows before they reach us, so it stays out of the
    // way there too. The pressed arrow just enters at the roving cell; the grid's
    // own delegation handles every move after that.
    const rovingCellRef = useRef({ row: focusRow, col: focusCol });
    useEffect(() => { rovingCellRef.current = { row: focusRow, col: focusCol }; }, [focusRow, focusCol]);
    useEffect(() => {
        const enterOnArrow = (e) => {
            if (document.activeElement !== document.body) return;
            // Modified arrows are browser/OS chords (Alt+Left is history Back).
            if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
            if (!/^Arrow(Up|Down|Left|Right)$/.test(e.key)) return;
            const { row, col } = rovingCellRef.current;
            const el = scrollContainerRef.current?.querySelector(`[data-row="${row}"][data-col="${col}"]`);
            if (!el) return;
            e.preventDefault();
            el.focus();
        };
        window.addEventListener('keydown', enterOnArrow);
        return () => window.removeEventListener('keydown', enterOnArrow);
    }, []);

    return (
        <div className="flex-1 flex flex-col overflow-hidden relative select-none bg-surface-1">
            {menuState.isOpen && (
                <ContextMenu
                    ref={menuRef}
                    x={menuState.x}
                    y={menuState.y}
                    activeOption={menuState.activeOption}
                    grouping={grouping}
                    colInGroup={menuState.col % grouping}
                    clickable={menuState.source === 'menu'}
                    onSelect={selectOption}
                    onHover={hoverOption}
                />
            )}
            {/* Playhead off-screen indicators - Fixed at top corners */}
            {playheadOffRight && !autoScroll && (
                <div className="absolute right-0 top-0 h-6 md:h-8 flex items-center pr-0 z-50 pointer-events-none">
                    <div className={`text-accent transition-opacity ${isPlaying ? 'animate-pulse-subtle' : ''}`}>
                        <Icon id="arrow-right" className="w-10 h-10" />
                    </div>
                </div>
            )}
            {playheadOffLeft && !autoScroll && (
                <div className="absolute left-0 md:left-0 top-0 h-6 md:h-8 flex items-center pl-0 z-50 pointer-events-none">
                    <div className={`text-accent transition-opacity ${isPlaying ? 'animate-pulse-subtle' : ''}`}>
                        <Icon id="arrow-left" className="w-10 h-10" />
                    </div>
                </div>
            )}
            <div
                ref={scrollContainerRef}
                className="relative flex-1 overflow-x-auto overflow-y-auto overscroll-contain"
                data-sequencer-scroll-container="true"
                onWheel={handleWheel}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
            >
                <div style={{ width: 'max-content', minWidth: '100%', height: '100%', display: 'flex', flexDirection: 'row' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>

                        {/* Header (Beat Numbers) - Now clickable for seeking */}
                        <SequencerHeader
                            stepCount={stepCount}
                            stepsPerMeasure={stepsPerMeasure}
                            grouping={grouping}
                            currentStep={currentStep}
                            pendingDelete={pendingDelete}
                            zoom={zoom}
                            gridOriginOffset={gridOriginOffset}
                            onSeek={handleSeek}
                            onSeekStep={seekToStep}
                        />

                        <div className="relative flex">
                            {/* Grid */}
                            <div className="flex flex-col mb-4">
                                {/* Roving-tabindex grid (APG pattern): focus lives on the
                                    cells, so the container is intentionally not a tab stop. */}
                                {/* eslint-disable-next-line jsx-a11y/interactive-supports-focus */}
                                <div
                                    role="grid"
                                    aria-label="Step sequencer"
                                    aria-rowcount={INSTRUMENTS.length}
                                    // +1 for the sticky rowheader column each row
                                    // carries before its pads (colindex 1); pads
                                    // therefore start at colindex 2.
                                    aria-colcount={stepCount + 1}
                                    className="flex flex-col"
                                    onKeyDown={handleGridKeyDown}
                                    onFocus={() => setGridHasFocus(true)}
                                    onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setGridHasFocus(false); }}
                                >
                                {INSTRUMENTS.map((instrument, rowIdx) => (
                                    <MemoizedInstrumentRow
                                        key={instrument}
                                        instrument={instrument}
                                        rowIdx={rowIdx}
                                        gridRow={grid[rowIdx]}
                                        humanizedRow={humanizedMask?.[rowIdx]}
                                        stepCount={stepCount}
                                        stepsPerMeasure={stepsPerMeasure}
                                        grouping={grouping}
                                        toggleStep={toggleStep}
                                        bulkUpdateStep={bulkUpdateStep}
                                        setMenuState={setMenuState}
                                        pendingDelete={pendingDelete}
                                        zoom={zoom}
                                        visibleRange={renderRange}
                                        focusedCol={focusRow === rowIdx ? focusCol : -1}
                                        onFocusCell={handleFocusCell}
                                    />
                                ))}
                                </div>

                                {/* Delete Measure Footer */}
                                <MeasureControls
                                    measureCount={measureCount}
                                    stepsPerMeasure={stepsPerMeasure}
                                    grouping={grouping}
                                    pendingDelete={pendingDelete}
                                    setPendingDelete={setPendingDelete}
                                    removeMeasure={removeMeasure}
                                    zoom={zoom}
                                    gridOriginOffset={gridOriginOffset}
                                />
                            </div>

                            <button
                                onClick={() => addMeasure()}
                                style={{ width: ZOOM_CONFIG[zoom].cellHeight }}
                                className="flex-none w-12 self-stretch flex items-center justify-center cursor-pointer bg-surface-6 hover:bg-surface-4 text-fg-dim hover:text-primary transition-all border border-surface-5 border-r-0 mt-1 mb-4 group/add-btn"
                                title="Add Measure"
                                aria-label="Add measure"
                            >
                                <span className="text-xl font-light transition-transform">+</span>
                            </button>

                            {/* Playhead Overlay - Perfectly Aligned via Grid Mapping (subtract cellHeight to account for border) */}
                            <PlayheadOverlay
                                stepCount={stepCount}
                                currentStep={currentStep}
                                grouping={grouping}
                                zoom={zoom}
                                measureCount={measureCount}
                                gridOriginOffset={gridOriginOffset}
                            />
                        </div>

                    </div>
                </div>
            </div>
        </div >
    );
}
