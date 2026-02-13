// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { useState, useEffect, useRef, useCallback } from 'react';
import { stepToX } from '../utils/sequencerGeometry';

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

    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) return;

        const measure = () => {
            metricsRef.current = {
                gridOriginOffset: gridOriginOffset ?? 48,
                containerWidth: container.clientWidth,
            };

            const hasScroll = container.scrollWidth > container.clientWidth;
            setCanScroll(hasScroll);
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
    }, [currentStep, grouping, autoScroll, zoom, scrollContainerRef]);

    const handleManualScroll = useCallback(() => {
        if (autoScroll) setAutoScroll(false);
    }, [autoScroll, setAutoScroll]);

    return {
        playheadOffRight,
        playheadOffLeft,
        handleManualScroll
    };
}
