// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { useState, useRef, useCallback } from 'react';

// If a touch event happened recently, ignore the following synthetic mouse events
const MOUSE_IGNORE_THRESHOLD = 500; // ms

export function useLongPress({ onLongPress, onClick, delay = 300 }) {
    const [isLongPressing, setIsLongPressing] = useState(false);
    const timerRef = useRef(null);
    const isInsideRef = useRef(false);
    const startPosRef = useRef({ x: 0, y: 0 });
    const lastTouchRef = useRef(0);

    const shouldIgnoreMouseEvent = (e) => {
        // Consider it a mouse event only if mouse-specific properties are present
        // (tests call mouse handlers with clientX/clientY). Treat unknown/empty
        // event objects as non-mouse so touchend still works in tests and browsers.
        const isMouseEvent = !!(e && typeof e.clientX === 'number');
        if (!isMouseEvent) return false;

        const last = lastTouchRef.current;
        return last && (Date.now() - last) < MOUSE_IGNORE_THRESHOLD;
    };

    const start = useCallback((e) => {
        // Ignore synthetic mouse events that follow a touch
        if (shouldIgnoreMouseEvent(e)) return;

        const isTouch = !!e.touches;
        if (isTouch) lastTouchRef.current = Date.now();

        const clientX = isTouch ? e.touches[0].clientX : e.clientX;
        const clientY = isTouch ? e.touches[0].clientY : e.clientY;

        startPosRef.current = { x: clientX, y: clientY };
        isInsideRef.current = true;

        timerRef.current = setTimeout(() => {
            if (isInsideRef.current) {
                setIsLongPressing(true);
                onLongPress?.();
            }
        }, delay);
    }, [onLongPress, delay]);

    const stop = useCallback((e, wasCancelled = false) => {
        // Ignore synthetic mouse events that follow a touch
        if (shouldIgnoreMouseEvent(e)) return;

        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }

        if (!isLongPressing && isInsideRef.current && !wasCancelled) {
            onClick?.();
        }

        setIsLongPressing(false);
        isInsideRef.current = false;
    }, [isLongPressing, onClick, timerRef]);

    const move = useCallback((e) => {
        // Ignore synthetic mouse events that follow a touch
        if (shouldIgnoreMouseEvent(e)) return;

        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        // If distance moved is more than 10px, it's not a long press stay
        const dist = Math.sqrt(
            Math.pow(clientX - startPosRef.current.x, 2) +
            Math.pow(clientY - startPosRef.current.y, 2)
        );

        if (!isLongPressing && dist > 10) {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
            }
            isInsideRef.current = false;
        }
    }, [isLongPressing, timerRef]);

    return [
        {
            onMouseDown: start,
            onMouseUp: stop,
            onMouseLeave: (e) => stop(e, true),
            onMouseMove: move,
            onTouchStart: start,
            onTouchEnd: stop,
            onTouchMove: move,
        },
        isLongPressing
    ];
}
