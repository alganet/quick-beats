// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { useRef, useLayoutEffect, useState, useImperativeHandle, forwardRef, Fragment } from 'react';
import { FILL_MODES } from '../data/sequencerConfig';

// Lifted above the touch point so a finger does not cover it.
const FINGER_CLEARANCE_PX = 130;
const EDGE_PADDING_PX = 12;

const ContextMenu = forwardRef(({ x, y, activeOption, grouping, colInGroup }, ref) => {
    const [offset, setOffset] = useState(0);
    const [yOffset, setYOffset] = useState(0);
    const menuRef = useRef(null);

    useImperativeHandle(ref, () => menuRef.current);

    useLayoutEffect(() => {
        if (!menuRef.current) return;
        // Clamp from the requested anchor and the menu's own size, not from its
        // measured position: the rect already carries whatever offset the last
        // run applied, so measuring it compounds rather than settles.
        const { width, height } = menuRef.current.getBoundingClientRect();

        const naturalLeft = x - width / 2; // the box is translateX(-50%)
        let dx = 0;
        if (naturalLeft < EDGE_PADDING_PX) {
            dx = EDGE_PADDING_PX - naturalLeft;
        } else if (naturalLeft + width > window.innerWidth - EDGE_PADDING_PX) {
            dx = window.innerWidth - EDGE_PADDING_PX - (naturalLeft + width);
        }

        // The vertical twin the horizontal clamp never had. Without it the finger
        // clearance pushes the menu off the top of the screen for the first
        // instrument row on a short viewport, with nothing to recover it.
        const naturalTop = y - FINGER_CLEARANCE_PX;
        let dy = 0;
        if (naturalTop < EDGE_PADDING_PX) {
            dy = EDGE_PADDING_PX - naturalTop;
        } else if (naturalTop + height > window.innerHeight - EDGE_PADDING_PX) {
            dy = window.innerHeight - EDGE_PADDING_PX - (naturalTop + height);
        }

        setOffset(dx);
        setYOffset(dy);
    }, [x, y]);

    // Metadata per fill mode, keyed by id (built once). The `pattern` previews
    // which cells the mode fills/clears within two groups.
    const OPTION_META = {
        repeat: {
            id: 'repeat',
            label: 'Repeat',
            pattern: (idx) => idx % grouping === colInGroup ? 'fill' : 'none'
        },
        alternate: {
            id: 'alternate',
            label: 'Alternate',
            pattern: (idx) => {
                if (idx === colInGroup) return 'fill';
                if (idx === colInGroup + grouping) return 'clear';
                return 'none';
            }
        },
        clear: {
            id: 'clear',
            label: 'Clear',
            pattern: (idx) => idx % grouping === colInGroup ? 'clear' : 'none'
        }
    };

    return (
        <div
            ref={menuRef}
            id="fill-menu"
            role="menu"
            aria-label="Fill pattern"
            // A keyboard-opened menu takes focus (Sequencer moves it here), so
            // this composite is a valid aria-activedescendant host: as the option
            // cycles, the referenced fill-<id> item is announced natively.
            tabIndex={-1}
            aria-activedescendant={activeOption ? `fill-${activeOption}` : undefined}
            className="fixed z-[100] bg-surface-3 border border-border-default shadow-2xl rounded-lg overflow-hidden pointer-events-none focus:outline-none"
            style={{
                left: x + offset,
                top: y - FINGER_CLEARANCE_PX + yOffset,
                transform: 'translateX(-50%)'
            }}
        >
            <div className="flex flex-col p-1 gap-1">
                {/* Rendered in the shared FILL_MODES order so the menu and the
                    keyboard cycling can't drift apart; unknown ids are skipped
                    rather than crashing the render. */}
                {FILL_MODES.map((id) => OPTION_META[id]).filter(Boolean).map((opt) => (
                    <div
                        key={opt.id}
                        id={`fill-${opt.id}`}
                        role="menuitemradio"
                        aria-checked={activeOption === opt.id}
                        aria-label={opt.label}
                        className={`flex items-center cursor-pointer gap-3 px-3 py-2 rounded-md transition-colors ${activeOption === opt.id ? 'bg-primary-hover text-fg-on-primary' : 'text-fg-secondary'}`}
                    >
                        <span className="text-[11px] font-bold uppercase tracking-wider w-16">{opt.label}</span>
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
            {/* Arrow down - adjusted to point to the pad even when menu is offset.
                A horizontal offset it can follow, by walking back along the edge
                it already sits on. A vertical one it cannot: the clamp moves the
                menu off its anchor entirely, and an arrow on the bottom edge
                would then point at whatever the menu had been lifted over. Drop
                it rather than let it lie about where the pad is. */}
            {yOffset === 0 && (
                <div
                    className="absolute -bottom-1 w-2 h-2 bg-surface-3 border-r border-b border-border-default rotate-45"
                    style={{
                        left: `calc(50% - ${offset}px)`,
                        marginLeft: '-4px'
                    }}
                />
            )}
        </div>
    );
});

ContextMenu.displayName = 'ContextMenu';

export default ContextMenu;
