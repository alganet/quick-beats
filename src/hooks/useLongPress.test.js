// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useLongPress } from './useLongPress';

describe('useLongPress', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    it('triggers onClick on short press (mouse)', () => {
        const onClick = vi.fn();
        const onLongPress = vi.fn();
        const { result } = renderHook(() => useLongPress({ onClick, onLongPress }));
        const handlers = result.current[0];

        act(() => {
            handlers.onMouseDown({ clientX: 0, clientY: 0 });
            vi.advanceTimersByTime(100);
            handlers.onMouseUp({});
        });

        expect(onClick).toHaveBeenCalled();
        expect(onLongPress).not.toHaveBeenCalled();
    });

    it('triggers onLongPress after delay (mouse)', () => {
        const onClick = vi.fn();
        const onLongPress = vi.fn();
        const { result } = renderHook(() => useLongPress({ onClick, onLongPress, delay: 500 }));

        act(() => {
            result.current[0].onMouseDown({ clientX: 0, clientY: 0 });
            vi.advanceTimersByTime(500);
        });

        expect(onLongPress).toHaveBeenCalled();
        expect(onClick).not.toHaveBeenCalled();
        
        // Ensure onClick is not called after releasing
        act(() => {
            result.current[0].onMouseUp({});
        });
        expect(onClick).not.toHaveBeenCalled();
    });

    it('cancels long press on move', () => {
        const onClick = vi.fn();
        const onLongPress = vi.fn();
        const { result } = renderHook(() => useLongPress({ onClick, onLongPress }));
        const handlers = result.current[0];

        act(() => {
            handlers.onMouseDown({ clientX: 0, clientY: 0 });
            // Move more than 10px
            handlers.onMouseMove({ clientX: 20, clientY: 20 });
            vi.advanceTimersByTime(500);
        });

        expect(onLongPress).not.toHaveBeenCalled();
    });

    it('cancels long press on mouse leave', () => {
        const onClick = vi.fn();
        const onLongPress = vi.fn();
        const { result } = renderHook(() => useLongPress({ onClick, onLongPress }));
        const handlers = result.current[0];

        act(() => {
            handlers.onMouseDown({ clientX: 0, clientY: 0 });
            handlers.onMouseLeave({});
            vi.advanceTimersByTime(500);
        });

        expect(onLongPress).not.toHaveBeenCalled();
        expect(onClick).not.toHaveBeenCalled();
    });
    
    it('handles touch events', () => {
        const onClick = vi.fn();
        const onLongPress = vi.fn();
        const { result } = renderHook(() => useLongPress({ onClick, onLongPress }));
        const handlers = result.current[0];
        
        // Simulate touch
        act(() => {
            handlers.onTouchStart({ touches: [{ clientX: 0, clientY: 0 }] });
            vi.advanceTimersByTime(500);
        });
        
        expect(onLongPress).toHaveBeenCalled();
    });

    it('does not double-fire when touch is followed by synthetic mouse events', () => {
        const onClick = vi.fn();
        const onLongPress = vi.fn();
        const { result } = renderHook(() => useLongPress({ onClick, onLongPress }));
        const handlers = result.current[0];

        // Short touch -> should call onClick once
        act(() => {
            handlers.onTouchStart({ touches: [{ clientX: 0, clientY: 0 }] });
            handlers.onTouchEnd({});
        });

        expect(onClick).toHaveBeenCalledTimes(1);

        // Synthetic mouse events that follow a touch must be ignored
        act(() => {
            handlers.onMouseDown({ clientX: 0, clientY: 0 });
            handlers.onMouseUp({});
        });

        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('does not trigger long press if mouse leaves before delay', () => {
        const onClick = vi.fn();
        const onLongPress = vi.fn();
        const { result } = renderHook(() => useLongPress({ onClick, onLongPress }));
        const handlers = result.current[0];

        act(() => {
            handlers.onMouseDown({ clientX: 0, clientY: 0 });
            handlers.onMouseLeave({ clientX: 0, clientY: 0 });
            vi.advanceTimersByTime(500);
        });

        expect(onLongPress).not.toHaveBeenCalled();
        expect(onClick).not.toHaveBeenCalled();
    });

    it('ignores mouse move that is within threshold', () => {
        const onClick = vi.fn();
        const onLongPress = vi.fn();
        const { result } = renderHook(() => useLongPress({ onClick, onLongPress }));
        const handlers = result.current[0];

        act(() => {
            handlers.onMouseDown({ clientX: 0, clientY: 0 });
            handlers.onMouseMove({ clientX: 5, clientY: 5 });
            vi.advanceTimersByTime(500);
        });

        expect(onLongPress).toHaveBeenCalled();
    });
});
