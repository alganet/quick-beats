// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { useState, useRef, useEffect, useCallback } from 'react';
import { FILL_MODES } from '../data/sequencerConfig';

export function useSequencerSelection({ onBulkUpdate }) {
    const [menuState, setMenuState] = useState({
        isOpen: false,
        x: 0,
        y: 0,
        row: null,
        col: null,
        activeOption: null,
        source: 'drag' // 'drag' (touch long-press) | 'menu' (right-click / keyboard)
    });
    
    const menuRef = useRef(null);
    const menuStateRef = useRef(menuState);
    const bulkUpdateStepRef = useRef(onBulkUpdate);

    useEffect(() => {
        menuStateRef.current = menuState;
    }, [menuState]);

    useEffect(() => {
        bulkUpdateStepRef.current = onBulkUpdate;
    }, [onBulkUpdate]);

    // 'menu' mode (right-click or keyboard): arrow keys cycle the option,
    // Enter/Space commit, Escape/Tab cancel. Capture phase + stopImmediatePropagation
    // so the grid's own keydown handler doesn't also act on these keys. Focus is on
    // the menu itself (Sequencer moves it there), so these fire while it's open.
    useEffect(() => {
        if (!menuState.isOpen || menuState.source !== 'menu') return;

        const handleKey = (e) => {
            const current = menuStateRef.current;
            const close = () => setMenuState(prev => ({ ...prev, isOpen: false }));

            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                e.stopImmediatePropagation();
                const idx = Math.max(0, FILL_MODES.indexOf(current.activeOption));
                const next = e.key === 'ArrowDown'
                    ? (idx + 1) % FILL_MODES.length
                    : (idx - 1 + FILL_MODES.length) % FILL_MODES.length;
                setMenuState(prev => ({ ...prev, activeOption: FILL_MODES[next] }));
            } else if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopImmediatePropagation();
                if (current.activeOption) {
                    bulkUpdateStepRef.current(current.row, current.col, current.activeOption);
                }
                close();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                e.stopImmediatePropagation();
                close();
            } else if (e.key === 'Tab') {
                close(); // let focus move on naturally
            }
        };

        window.addEventListener('keydown', handleKey, true);
        return () => window.removeEventListener('keydown', handleKey, true);
    }, [menuState.isOpen, menuState.source]);

    // 'drag' mode (touch/pen long-press): track the pointer over the options and
    // commit whichever it's released on.
    useEffect(() => {
        if (!menuState.isOpen || menuState.source !== 'drag') return;

        const handleMove = (e) => {
            e.stopImmediatePropagation();
            if (e.cancelable) e.preventDefault();

            const clientY = e.touches ? e.touches[0].clientY : e.clientY;

            if (!menuRef.current) return;
            const rect = menuRef.current.getBoundingClientRect();
            const relativeY = clientY - rect.top;

            let option = null;
            const itemHeight = rect.height / 3;
            const optIdx = Math.floor(relativeY / itemHeight);

            if (optIdx === 0) option = 'repeat';
            else if (optIdx === 1) option = 'alternate';
            else if (optIdx === 2) option = 'clear';

            if (option !== menuStateRef.current.activeOption) {
                setMenuState(prev => ({ ...prev, activeOption: option }));
            }
        };

        const handleEnd = () => {
            const current = menuStateRef.current;
            if (current.activeOption) {
                bulkUpdateStepRef.current(current.row, current.col, current.activeOption);
            }
            setMenuState(prev => ({ ...prev, isOpen: false }));
        };

        const handleCancel = () => {
            setMenuState(prev => ({ ...prev, isOpen: false }));
        };

        window.addEventListener('mousemove', handleMove, { passive: false });
        window.addEventListener('mouseup', handleEnd);
        window.addEventListener('touchmove', handleMove, { passive: false });
        window.addEventListener('touchend', handleEnd);
        window.addEventListener('touchcancel', handleCancel);

        return () => {
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleEnd);
            window.removeEventListener('touchmove', handleMove);
            window.removeEventListener('touchend', handleEnd);
            window.removeEventListener('touchcancel', handleCancel);
        };
    }, [menuState.isOpen, menuState.source]);

    // 'menu' mode is persistent: a pointer press outside it dismisses it. Attached
    // on the next tick so the very click that opened it (the right-press) doesn't
    // immediately close it. Scrolling dismisses too (like a native context menu):
    // the menu is position:fixed over a scrollable grid, so any scroll leaves it
    // floating over pads it no longer belongs to — its row/col would then commit
    // a fill nowhere near the visible menu. Scroll events don't bubble, hence the
    // capture-phase document listener.
    useEffect(() => {
        if (!menuState.isOpen || menuState.source !== 'menu') return;
        const close = () => setMenuState(prev => ({ ...prev, isOpen: false }));
        const handleDown = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                close();
            }
        };
        const id = setTimeout(() => {
            document.addEventListener('mousedown', handleDown);
            document.addEventListener('touchstart', handleDown);
        }, 0);
        document.addEventListener('wheel', close, { capture: true, passive: true });
        document.addEventListener('scroll', close, { capture: true, passive: true });
        return () => {
            clearTimeout(id);
            document.removeEventListener('mousedown', handleDown);
            document.removeEventListener('touchstart', handleDown);
            document.removeEventListener('wheel', close, { capture: true });
            document.removeEventListener('scroll', close, { capture: true });
        };
    }, [menuState.isOpen, menuState.source]);

    // Commit an option (a click in 'menu' mode) and close.
    const selectOption = useCallback((optionId) => {
        const current = menuStateRef.current;
        if (optionId) bulkUpdateStepRef.current(current.row, current.col, optionId);
        setMenuState(prev => ({ ...prev, isOpen: false }));
    }, []);

    // Highlight an option under the pointer (hover in 'menu' mode).
    const hoverOption = useCallback((optionId) => {
        setMenuState(prev => (prev.activeOption === optionId ? prev : { ...prev, activeOption: optionId }));
    }, []);

    return {
        menuState,
        setMenuState,
        menuRef,
        selectOption,
        hoverOption,
    };
}
