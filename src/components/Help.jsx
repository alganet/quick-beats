// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { useState } from 'react';
import { Icon } from './Icons';

function HelpSection({ title, children }) {
    return (
        <section className="mb-8 md:mb-10">
            <h2 className="text-primary text-xs font-black uppercase tracking-[0.3em] mb-4">{title}</h2>
            <div className="bg-surface-2 border border-border-dim p-4 md:p-6">
                {children}
            </div>
        </section>
    );
}

function MiniPad({ active, clearing, className = '' }) {
    return (
        <div className={`w-4 h-4 md:w-4 md:h-4 rounded-sm flex-shrink-0 ${clearing
            ? 'bg-border-medium'
            : active
                ? 'bg-primary'
                : 'bg-surface-6 border border-border-medium'
            } ${className}`}
        />
    );
}

export default function Help({ isOpen, onClose, showKeyboardCheatsheet = false }) {
    const [demoZoom, setDemoZoom] = useState(1);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[110] flex flex-col items-center justify-start p-4 bg-surface-0 overflow-y-auto">
            <div className="max-w-2xl w-full pb-12 pt-4 md:pt-12">
                <div className="flex items-center justify-between mb-8 md:mb-12 border-b border-border-dim pb-6">
                    <div className="flex items-center gap-3">
                        <Icon id="help" className="w-6 h-6 text-primary" />
                        <h1 className="text-2xl md:text-4xl font-black tracking-tighter text-fg uppercase">How to Use</h1>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-fg-muted hover:text-fg transition-colors border border-border-default px-4 py-2 uppercase font-mono text-[10px] tracking-widest"
                    >
                        Close [ESC]
                    </button>
                </div>

                {/* Keyboard cheatsheet (only for pointer: fine) */}
                {showKeyboardCheatsheet && (
                    <HelpSection title="Keyboard Shortcuts">
                        <div className="columns-2 gap-2 text-fg-secondary text-xs">
                            <div className="flex items-center gap-3">
                                <div className="font-mono bg-surface-0 border border-border-dim px-2 w-12 text-center py-1 text-fg text-[11px]">Space</div>
                                <div>Play / Pause</div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="font-mono bg-surface-0 border border-border-dim px-2 w-12 text-center py-1 text-fg text-[11px]">-</div>
                                <div>Decrease BPM</div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="font-mono bg-surface-0 border border-border-dim px-2 w-12 text-center py-1 text-fg text-[11px]">=</div>
                                <div>Increase BPM</div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="font-mono bg-surface-0 border border-border-dim px-2 w-12 text-center py-1 text-fg text-[11px]">z</div>
                                <div>Toggle zoom</div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="font-mono bg-surface-0 border border-border-dim px-2 w-12 text-center py-1 text-fg text-[11px]">s</div>
                                <div>Toggle auto-scroll</div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="font-mono bg-surface-0 border border-border-dim px-2 w-12 text-center py-1 text-fg text-[11px]">?</div>
                                <div>Show this help</div>
                            </div>
                        </div>
                    </HelpSection>
                )}

                {/* Zoom */}
                <HelpSection title="Zoom">
                    <div className="flex flex-col md:flex-row gap-4 md:gap-6 items-start">
                        <div className="flex items-center gap-2 m-auto flex-shrink-0">
                            <button
                                onClick={() => setDemoZoom((demoZoom + 1) % 3)}
                                className="w-8 h-8 flex items-center justify-center bg-surface-5 text-fg-secondary hover:text-fg transition-all hover:scale-105 active:scale-95 cursor-pointer"
                            >
                                <Icon id={`zoom-${demoZoom}`} className="w-5 h-5" />
                            </button>
                            <span className="text-[10px] font-mono text-fg-muted uppercase">
                                {['Small', 'Medium', 'Large'][demoZoom]}
                            </span>
                        </div>
                        <p className="text-fg-secondary text-xs md:text-sm leading-relaxed">
                            Tap the zoom button to cycle through three sizes.
                            Use <span className="text-fg font-mono text-[10px] bg-surface-5 px-1.5 py-0.5 mx-0.5">small</span> to
                            see more measures, <span className="text-fg font-mono text-[10px] bg-surface-5 px-1.5 py-0.5 mx-0.5">large</span> for
                            precise editing on mobile.
                        </p>
                    </div>
                </HelpSection>

                {/* Auto-scroll */}
                <HelpSection title="Auto-Scroll">
                    <div className="flex flex-col md:flex-row gap-4 md:gap-6 items-start">
                        <div className="flex items-center gap-3 m-auto flex-shrink-0">
                            <div className="flex items-center gap-1.5">
                                <div className="w-8 h-8 flex items-center justify-center bg-surface-inverted text-fg-on-inverted shadow-[0_0_12px_color-mix(in_srgb,var(--color-highlight)_30%,transparent)]">
                                    <Icon id="follow" className="w-4 h-4" />
                                </div>
                                <span className="text-[10px] font-mono text-green-400">ON</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-8 h-8 flex items-center justify-center bg-surface-5 text-fg-muted">
                                    <Icon id="unfollow" className="w-4 h-4" />
                                </div>
                                <span className="text-[10px] font-mono text-fg-muted">OFF</span>
                            </div>
                        </div>
                        <p className="text-fg-secondary text-xs md:text-sm leading-relaxed">
                            When <span className="text-fg">ON</span>, the view follows the playhead automatically.
                            This button only appears when your pattern is wide enough to scroll.
                            Manually scrolling will turn it off.
                        </p>
                    </div>
                </HelpSection>

                {/* Long Press */}
                <HelpSection title="Long Press — Fill Patterns">
                    <div className="flex flex-col gap-4">
                        <div className="flex flex-col md:flex-row gap-4 md:gap-6 items-start border-b border-surface-5 p-2">
                            <div className="flex-shrink-0 m-auto">
                                <div className="flex items-center gap-1 mb-2">
                                    {/* Simulated row with a "pattern" */}
                                    <MiniPad active />
                                    <MiniPad />
                                    <MiniPad />
                                    <MiniPad />
                                </div>
                                <div className="text-[9px] font-mono text-fg-dim text-left mt-1 ml-1.5 animate-pulse">↑ long press</div>
                            </div>
                            <p className="text-fg-secondary text-xs md:text-sm leading-relaxed">
                                Long-press any pad to open a context menu. Drag to select an action:
                            </p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-3">
                            <div className="bg-surface-0 border border-border-dim p-3 flex flex-col items-center gap-2">
                                <div className="flex items-center gap-0.5">
                                    <MiniPad active /><MiniPad /><MiniPad /><MiniPad />
                                    <div className="w-1" />
                                    <MiniPad active /><MiniPad /><MiniPad /><MiniPad />
                                </div>
                                <span className="text-[10px] font-mono text-fg uppercase">Repeat</span>
                                <span className="text-[9px] text-fg-muted">Fill every matching beat</span>
                            </div>
                            <div className="bg-surface-0 border border-border-dim p-3 flex flex-col items-center gap-2">
                                <div className="flex items-center gap-0.5">
                                    <MiniPad active /><MiniPad /><MiniPad /><MiniPad />
                                    <div className="w-1" />
                                    <MiniPad clearing /><MiniPad /><MiniPad /><MiniPad />
                                </div>
                                <span className="text-[10px] font-mono text-fg uppercase">Alternate</span>
                                <span className="text-[9px] text-fg-muted">Every other group</span>
                            </div>
                            <div className="bg-surface-0 border border-border-dim p-3 flex flex-col items-center gap-2">
                                <div className="flex items-center gap-0.5">
                                    <MiniPad clearing /><MiniPad /><MiniPad /><MiniPad />
                                    <div className="w-1" />
                                    <MiniPad clearing /><MiniPad /><MiniPad /><MiniPad />
                                </div>
                                <span className="text-[10px] font-mono text-fg uppercase">Clear</span>
                                <span className="text-[9px] text-fg-muted">Remove from all beats</span>
                            </div>
                        </div>
                    </div>
                </HelpSection>

                {/* Adding Measures */}
                <HelpSection title="Adding Measures">
                    <div className="flex flex-col md:flex-row gap-4 md:gap-6 items-start">
                        <div className="flex-shrink-0 flex items-center gap-2 m-auto">
                            <div className="w-10 h-16 bg-surface-2 border border-border-dim flex items-center justify-center text-fg-dim hover:text-primary transition-colors">
                                <span className="text-3xl font-light">+</span>
                            </div>
                        </div>
                        <p className="text-fg-secondary text-xs md:text-sm leading-relaxed">
                            Tap the <span className="text-fg font-bold">+</span> bar on the right edge of the grid to add a new measure.
                            The new measure is intelligently filled based on repeating patterns it detects in your existing beats.
                        </p>
                    </div>
                </HelpSection>

                {/* Deleting Measures */}
                <HelpSection title="Deleting Measures">
                    <div className="flex flex-col gap-4">
                        <div className="flex flex-col md:flex-row gap-4 md:gap-6 items-start">
                            <div className="flex-shrink-0 flex flex-col items-center gap-1 m-auto">
                                {/* Mini measure grid */}
                                <div className="flex flex-col gap-0.5">
                                    <div className="flex gap-0.5">
                                        <MiniPad active /><MiniPad /><MiniPad active /><MiniPad />
                                    </div>
                                    <div className="flex gap-0.5">
                                        <MiniPad /><MiniPad active /><MiniPad /><MiniPad />
                                    </div>
                                </div>
                                <div className="w-full h-7 mt-1 bg-surface-2 border border-border-dim flex items-center justify-center">
                                    <span className="text-lg font-bold text-red-900">−</span>
                                </div>
                            </div>
                            <div className="text-fg-secondary text-xs md:text-sm leading-relaxed">
                                <p className="mb-2">
                                    When you have more than one measure, a <span className="text-red-400">delete bar</span> appears below the grid.
                                    Tap a measure's bar to start deletion.
                                </p>
                                <p>
                                    A confirmation prompt will appear with
                                    {' '}<span className="text-[10px] font-mono font-bold text-red-500 bg-red-500/10 border border-red-500/30 px-1.5 py-0.5">Yes</span>{' '}
                                    and
                                    {' '}<span className="text-[10px] font-mono text-fg-secondary bg-highlight/5 border border-highlight/10 px-1.5 py-0.5">No</span>{' '}
                                    buttons, and the measure will fade to show what will be removed. The prompt auto-dismisses after 3 seconds.
                                </p>
                            </div>
                        </div>
                    </div>
                </HelpSection>

                {/* Credits */}
                <HelpSection title="About">
                    <p className="text-fg-secondary text-xs md:text-sm leading-relaxed mb-3 text-center">
                        Quick Beats is a minimalist drum machine for rapid sketching and sharing of rhythmic ideas.
                    </p>
                    <p className="text-fg-secondary text-xs md:text-sm leading-relaxed mb-3 text-center">
                        It was created by <a href="https://alganet.github.io" target="_blank" className="text-fg underline cursor-pointer">Alexandre Gomes Gaigalas</a> with the help of these amazing libraries:
                    </p>
                    <div className="flex flex-wrap gap-2 text-[10px] font-mono text-fg-secondary uppercase justify-center mb-3">
                        <span className="bg-surface-0 px-2 py-1 border border-border-dim">Tone.js</span>
                        <span className="bg-surface-0 px-2 py-1 border border-border-dim">React 19</span>
                        <span className="bg-surface-0 px-2 py-1 border border-border-dim">Tailwind CSS</span>
                        <span className="bg-surface-0 px-2 py-1 border border-border-dim">Vite</span>
                        <span className="bg-surface-0 px-2 py-1 border border-border-dim">AV Linux Black Pearl Kit</span>
                    </div>
                    <p className="text-fg-secondary text-xs md:text-sm leading-relaxed text-center">The full code is avaliable under the ISC license on <a href="https://github.com/alganet/quick-beats" target="_blank" className="text-fg underline cursor-pointer">GitHub</a>.</p>
                </HelpSection>

                <div className="text-center pt-8 border-t border-border-dim">
                    <button
                        onClick={onClose}
                        className="w-full md:w-64 bg-surface-inverted text-fg-on-inverted font-black py-4 hover:bg-surface-inverted-hover transition-all tracking-[0.3em] uppercase text-xs"
                    >
                        Got it
                    </button>
                </div>
            </div>
        </div>
    );
}
