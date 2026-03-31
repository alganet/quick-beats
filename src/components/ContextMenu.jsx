// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { useRef, useLayoutEffect, useState, useImperativeHandle, forwardRef, Fragment } from 'react';

const ContextMenu = forwardRef(({ x, y, activeOption, grouping, colInGroup }, ref) => {
    const [offset, setOffset] = useState(0);
    const menuRef = useRef(null);

    useImperativeHandle(ref, () => menuRef.current);

    useLayoutEffect(() => {
        if (menuRef.current) {
            const rect = menuRef.current.getBoundingClientRect();
            const padding = 12;
            let newOffset = 0;

            if (rect.left < padding) {
                newOffset = padding - rect.left;
            } else if (rect.right > window.innerWidth - padding) {
                newOffset = window.innerWidth - padding - rect.right;
            }

            if (newOffset !== 0) {
                // eslint-disable-next-line react-hooks/set-state-in-effect
                setOffset(newOffset);
            }
        }
    }, [x]);

    return (
        <div
            ref={menuRef}
            className="fixed z-[100] bg-surface-3 border border-border-default shadow-2xl rounded-lg overflow-hidden pointer-events-none"
            style={{
                left: x + offset,
                top: y - 130, // Higher to clear the finger
                transform: 'translateX(-50%)'
            }}
        >
            <div className="flex flex-col p-1 gap-1">
                {[
                    {
                        id: 'repeat',
                        label: 'Repeat',
                        pattern: (idx) => idx % grouping === colInGroup ? 'fill' : 'none'
                    },
                    {
                        id: 'alternate',
                        label: 'Alternate',
                        pattern: (idx) => {
                            if (idx === colInGroup) return 'fill';
                            if (idx === colInGroup + grouping) return 'clear';
                            return 'none';
                        }
                    },
                    {
                        id: 'clear',
                        label: 'Clear',
                        pattern: (idx) => idx % grouping === colInGroup ? 'clear' : 'none'
                    }
                ].map((opt) => (
                    <div
                        key={opt.id}
                        className={`flex items-center cursor-pointer gap-3 px-3 py-2 rounded-md transition-colors ${activeOption === opt.id ? 'bg-primary text-fg' : 'text-fg-secondary'}`}
                    >
                        <span className="text-[10px] font-bold uppercase tracking-wider w-16">{opt.label}</span>
                        <div className="flex gap-1 items-center">
                            {[...Array(grouping * 2)].map((_, i) => (
                                <Fragment key={i}>
                                    {i === grouping && <div className="w-[1px] h-3 bg-border-default mx-1" />}
                                    {(() => {
                                        const state = opt.pattern(i);
                                        const isFilled = state === 'fill';
                                        const isCleared = state === 'clear';
                                        const isActive = activeOption === opt.id;

                                        let bgColor = 'bg-transparent';
                                        let borderColor = 'border-border-default';

                                        if (isFilled) {
                                            bgColor = isActive ? 'bg-surface-inverted' : 'bg-primary';
                                            borderColor = isActive ? 'border-surface-inverted' : 'border-primary';
                                        } else if (isCleared) {
                                            bgColor = isActive ? 'bg-surface-inverted-active' : 'bg-border-medium';
                                            borderColor = isActive ? 'border-surface-inverted-active' : 'border-border-medium';
                                        }

                                        return (
                                            <div className={`w-3 h-3 rounded-sm border ${bgColor} ${borderColor}`} />
                                        );
                                    })()}
                                </Fragment>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
            {/* Arrow down - adjusted to point to the pad even when menu is offset */}
            <div
                className="absolute -bottom-1 w-2 h-2 bg-surface-3 border-r border-b border-border-default rotate-45"
                style={{
                    left: `calc(50% - ${offset}px)`,
                    marginLeft: '-4px'
                }}
            />
        </div>
    );
});

ContextMenu.displayName = 'ContextMenu';

export default ContextMenu;
