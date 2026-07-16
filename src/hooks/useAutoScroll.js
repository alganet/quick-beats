// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { useState, useEffect, useRef, useCallback } from 'react';
import { stepToX } from '../utils/sequencerGeometry';

// How far a finger must travel before it counts as a drag rather than a tap.
const TOUCH_SLOP_PX = 10;

export function useAutoScroll({ 
    scrollContainerRef, 
    currentStep, 
    stepCount, 
    grouping, 
    autoScroll, 
    setAutoScroll, 
    setCanScroll, 
    zoom,
    gridOriginOffset,
}) {
    const [playheadOffRight, setPlayheadOffRight] = useState(false);
    const [playheadOffLeft, setPlayheadOffLeft] = useState(false);
    const offRightRef = useRef(false);
    const offLeftRef = useRef(false);
    const metricsRef = useRef({
        gridOriginOffset: 48,
        containerWidth: 0,
    });
    const lastScrollTargetRef = useRef(null);
    const touchOriginRef = useRef(null);
    const [measureTick, setMeasureTick] = useState(0);

    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) return;

        const measure = () => {
            const prev = metricsRef.current;
            const next = {
                gridOriginOffset: gridOriginOffset ?? 48,
                containerWidth: container.clientWidth,
            };
            metricsRef.current = next;

            const hasScroll = container.scrollWidth > container.clientWidth;
            setCanScroll(hasScroll);

            // The off-screen effect below reads these metrics through a ref, so
            // it needs an explicit nudge to recompute when they change —
            // otherwise the playhead indicators keep the values measured before
            // the last resize, which a device rotation makes very visible.
            // Only bump on a real change; a ResizeObserver fires continuously
            // through a drag.
            if (prev.containerWidth !== next.containerWidth || prev.gridOriginOffset !== next.gridOriginOffset) {
                setMeasureTick(t => t + 1);
            }
        };

        const observer = new ResizeObserver(measure);
        observer.observe(container);
        window.addEventListener('resize', measure);
        measure();

        return () => {
            observer.disconnect();
            window.removeEventListener('resize', measure);
        };
    }, [setCanScroll, stepCount, zoom, scrollContainerRef, gridOriginOffset]);

    // Auto-scroll logic
    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) return;

        const { gridOriginOffset, containerWidth } = metricsRef.current;
        const currentPos = stepToX(currentStep, grouping, zoom);
        const scrollLeft = container.scrollLeft;

        const handlePos = currentPos + gridOriginOffset;

        // Update off-screen state
        const isOffRight = handlePos > scrollLeft + containerWidth;
        const isOffLeft = handlePos < scrollLeft + gridOriginOffset;

        if (isOffRight !== offRightRef.current) {
            offRightRef.current = isOffRight;
            setPlayheadOffRight(isOffRight);
        }
        if (isOffLeft !== offLeftRef.current) {
            offLeftRef.current = isOffLeft;
            setPlayheadOffLeft(isOffLeft);
        }

        if (!autoScroll) {
            lastScrollTargetRef.current = null;
            return;
        }

        let targetLeft = null;
        if (handlePos > scrollLeft + containerWidth - 100) {
            targetLeft = handlePos - (containerWidth / 2);
        } else if (handlePos < scrollLeft + gridOriginOffset + 20) {
            targetLeft = 0;
        }

        if (targetLeft !== null) {
            const clampedTarget = Math.max(0, Math.round(targetLeft));
            if (lastScrollTargetRef.current !== clampedTarget) {
                lastScrollTargetRef.current = clampedTarget;
                container.scrollTo({ left: clampedTarget, behavior: 'auto' });
            }
        }
    }, [currentStep, grouping, autoScroll, zoom, scrollContainerRef, measureTick]);

    // Taking over the horizontal scroll means the user no longer wants the view
    // following the playhead. A *vertical* gesture says nothing about that — but
    // the grid scrolls on both axes from a single element, so every scroll down
    // to reach the lower rows or the delete bar used to silently switch
    // auto-scroll off. Only horizontal intent counts.
    //
    // Read from the gesture rather than from a scroll listener on purpose: the
    // question is whether the *user* took over, and this container is scrolled
    // programmatically from three places (the effect above, keyboard
    // focus-into-view, centering a measure for deletion). A scroll listener
    // cannot tell those from a finger without every caller marking its writes.
    const stopFollowing = useCallback(() => {
        if (autoScroll) setAutoScroll(false);
    }, [autoScroll, setAutoScroll]);

    const handleWheel = useCallback((event) => {
        const container = scrollContainerRef.current;
        // A wheel that reports only deltaY still scrolls this container
        // *horizontally* when it has no vertical overflow to spend that delta
        // on — the browser falls back to the one axis that can move. So on a
        // desktop, where the grid nearly always fits vertically (and auto-fit
        // works to keep it that way), a plain mouse wheel is horizontal intent
        // however it is labelled. Only trust the axis when there is a vertical
        // overflow for a vertical scroll to actually go to.
        const canScrollVertically = container ? container.scrollHeight > container.clientHeight : false;
        if (!canScrollVertically || Math.abs(event.deltaX) > Math.abs(event.deltaY)) stopFollowing();
    }, [stopFollowing, scrollContainerRef]);

    const handleTouchStart = useCallback((event) => {
        const touch = event.touches?.[0];
        touchOriginRef.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
    }, []);

    const handleTouchMove = useCallback((event) => {
        const touch = event.touches?.[0];
        const origin = touchOriginRef.current;
        if (!touch || !origin) return;
        const dx = touch.clientX - origin.x;
        const dy = touch.clientY - origin.y;
        // Below the slop a tap is still a tap: fingers roll a pixel or two
        // between touchstart and touchmove, and without a floor that jitter
        // decides an axis and silently stops the follow.
        if (Math.hypot(dx, dy) < TOUCH_SLOP_PX) return;
        if (Math.abs(dx) > Math.abs(dy)) stopFollowing();
    }, [stopFollowing]);

    return {
        playheadOffRight,
        playheadOffLeft,
        handleWheel,
        handleTouchStart,
        handleTouchMove
    };
}
