// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useSequencerSelection } from './useSequencerSelection';

describe('useSequencerSelection', () => {
    let addEventListenerSpy;
    let removeEventListenerSpy;

    beforeEach(() => {
        addEventListenerSpy = vi.spyOn(window, 'addEventListener');
        removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('initializes with default state', () => {
        const { result } = renderHook(() => useSequencerSelection({ onBulkUpdate: vi.fn() }));
        expect(result.current.menuState).toEqual({
            isOpen: false,
            x: 0,
            y: 0,
            row: null,
            col: null,
            activeOption: null
        });
    });

    it('attaches listeners when menu opens', () => {
        const { result } = renderHook(() => useSequencerSelection({ onBulkUpdate: vi.fn() }));

        act(() => {
            result.current.setMenuState(prev => ({ ...prev, isOpen: true }));
        });

        expect(addEventListenerSpy).toHaveBeenCalledWith('mousemove', expect.any(Function), { passive: false });
        expect(addEventListenerSpy).toHaveBeenCalledWith('mouseup', expect.any(Function));
    });

    it('cleans up listeners when menu closes', () => {
        const { result } = renderHook(() => useSequencerSelection({ onBulkUpdate: vi.fn() }));

        act(() => {
            result.current.setMenuState(prev => ({ ...prev, isOpen: true }));
        });
        
        // Find the cleanup function or trigger state change?
        // The effect runs on [menuState.isOpen].
        // Changing it back to false should trigger cleanup of the previous effect run (if React semantics hold in renderHook)
        
        act(() => {
            result.current.setMenuState(prev => ({ ...prev, isOpen: false }));
        });

        expect(removeEventListenerSpy).toHaveBeenCalled();
    });

    it('handles drag selection (update activeOption)', () => {
        const { result } = renderHook(() => useSequencerSelection({ onBulkUpdate: vi.fn() }));

        // Mock the menu element
        const mockMenu = document.createElement('div');
        vi.spyOn(mockMenu, 'getBoundingClientRect').mockReturnValue({
            top: 100,
            height: 150, // 3 items of 50px
            left: 0, width: 100, bottom: 250, right: 100, x: 0, y: 100, toJSON: () => {}
        });

        // Set ref
        result.current.menuRef.current = mockMenu;

        // Open menu
        act(() => {
            result.current.setMenuState({
                isOpen: true,
                x: 0, y: 0, row: 0, col: 0, activeOption: null
            });
        });

        // Simulate move event on window
        // options: repeat (top), alternate (middle), clear (bottom)
        // Item height = 50. 
        // MouseY = 125 (relative 25 -> index 0 -> repeat)
        
        const moveEvent = new MouseEvent('mousemove', {
            bubbles: true,
            cancelable: true,
            clientY: 125
        });

        act(() => {
            window.dispatchEvent(moveEvent);
        });

        expect(result.current.menuState.activeOption).toBe('repeat');

        // Move to middle (relative 75 -> index 1 -> alternate)
        const moveEvent2 = new MouseEvent('mousemove', { clientY: 175 });
        act(() => {
            window.dispatchEvent(moveEvent2);
        });
        expect(result.current.menuState.activeOption).toBe('alternate');
        
        // Move to bottom (relative 125 -> index 2 -> clear)
        const moveEvent3 = new MouseEvent('mousemove', { clientY: 225 });
        act(() => {
            window.dispatchEvent(moveEvent3);
        });
        expect(result.current.menuState.activeOption).toBe('clear');
    });

    it('calls onBulkUpdate and closes on mouseup', () => {
        const onBulkUpdate = vi.fn();
        const { result } = renderHook(() => useSequencerSelection({ onBulkUpdate }));

        // Set state with active option
        act(() => {
            result.current.setMenuState({
                isOpen: true,
                x: 0, y: 0, row: 1, col: 2, activeOption: 'repeat'
            });
        });

        const upEvent = new MouseEvent('mouseup', { bubbles: true });
        act(() => {
            window.dispatchEvent(upEvent);
        });

        expect(onBulkUpdate).toHaveBeenCalledWith(1, 2, 'repeat');
        expect(result.current.menuState.isOpen).toBe(false);
    });
});
