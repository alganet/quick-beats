// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { useState, useRef, useEffect } from 'react';

export function useSequencerSelection({ onBulkUpdate }) {
    const [menuState, setMenuState] = useState({ 
        isOpen: false, 
        x: 0, 
        y: 0, 
        row: null, 
        col: null, 
        activeOption: null 
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

    useEffect(() => {
        if (!menuState.isOpen) return;

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
    }, [menuState.isOpen]);

    return {
        menuState,
        setMenuState,
        menuRef
    };
}
