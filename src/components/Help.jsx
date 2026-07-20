// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { useState } from 'react';
import { useDialog } from '../hooks/useDialog';
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

export default function Help({ isOpen, onClose, showKeyboardCheatsheet = false, singleKeyShortcuts = true, onToggleSingleKeyShortcuts, showIosInstallHint = false }) {
    const [demoZoom, setDemoZoom] = useState(1);
    const dialogRef = useDialog(isOpen, onClose);

    if (!isOpen) return null;

    return (
        <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="help-title"
            className="fixed inset-0 z-[110] flex flex-col items-center justify-start p-4 bg-surface-0 overflow-y-auto"
        >
            <div className="max-w-2xl w-full pb-12 pt-4 md:pt-12">
                <div className="flex items-center justify-between mb-8 md:mb-12 border-b border-border-dim pb-6">
                    <div className="flex items-center gap-3">
                        <Icon id="help" className="w-6 h-6 text-primary" />
                        <h1 id="help-title" className="text-2xl md:text-4xl font-black tracking-tighter text-fg uppercase">How to Use</h1>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-fg-muted hover:text-fg transition-colors border border-border-default px-4 py-2 uppercase font-mono text-[11px] tracking-widest"
                    >
                        Close [ESC]
                    </button>
                </div>

                {/* iOS install hint — iOS Safari never fires beforeinstallprompt,
                    so there's no header Install button; walk the user through the
                    manual Add-to-Home-Screen flow instead. */}
                {showIosInstallHint && (
                    <HelpSection title="Install app">
                        <div className="flex items-center gap-3">
                            <Icon id="install" className="w-6 h-6 text-primary flex-shrink-0" />
                            <p className="text-fg-secondary text-xs md:text-sm leading-relaxed">
                                Tap the <span className="text-fg">Share</span> button in Safari, then
                                choose <span className="text-fg">Add to Home Screen</span> to install
                                Quick Beats. It then runs full-screen and works offline.
                            </p>
                        </div>
                    </HelpSection>
                )}

                {/* Keyboard cheatsheet (only for pointer: fine) */}
                {showKeyboardCheatsheet && (
                    <HelpSection title="Keyboard Shortcuts">
                        <div className="columns-2 gap-2 text-fg-secondary text-xs">
                            <div className="flex items-center gap-3">
                                <div className="font-mono bg-surface-0 border border-border-dim px-2 w-12 text-center py-1 text-fg text-[11px]">p</div>
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
                                <div className="font-mono bg-surface-0 border border-border-dim px-2 w-12 text-center py-1 text-fg text-[11px]">h</div>
                                <div>Humanize / remove</div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="font-mono bg-surface-0 border border-border-dim px-2 w-12 text-center py-1 text-fg text-[11px]">?</div>
                                <div>Show this help</div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="font-mono bg-surface-0 border border-border-dim px-2 w-12 text-center py-1 text-fg text-[11px]">Arrows</div>
                                <div>Move between steps</div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="font-mono bg-surface-0 border border-border-dim px-2 w-12 text-center py-1 text-fg text-[11px]">Enter</div>
                                <div>Toggle focused step</div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="font-mono bg-surface-0 border border-border-dim px-2 w-12 text-center py-1 text-fg text-[11px]">Home</div>
                                <div>First step</div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="font-mono bg-surface-0 border border-border-dim px-2 w-12 text-center py-1 text-fg text-[11px]">End</div>
                                <div>Last step</div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="font-mono bg-surface-0 border border-border-dim px-2 w-12 text-center py-1 text-fg text-[11px]">Menu</div>
                                <div>Fill patterns</div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="font-mono bg-surface-0 border border-border-dim px-2 w-12 text-center py-1 text-fg text-[11px]">m</div>
                                <div>Fill patterns</div>
                            </div>
                        </div>
                        <p className="text-fg-secondary text-xs mt-4 leading-relaxed">
                            Tab to the beat ruler to seek the playhead with the arrow keys —
                            <span className="text-fg"> Page Up / Down</span> jumps by a bar.
                        </p>
                        {onToggleSingleKeyShortcuts && (
                            <div className="mt-5 pt-4 border-t border-border-dim flex items-center gap-3">
                                <button
                                    onClick={onToggleSingleKeyShortcuts}
                                    aria-pressed={singleKeyShortcuts}
                                    className={`px-3 py-1.5 border font-mono text-[11px] uppercase tracking-widest transition-colors ${singleKeyShortcuts
                                        ? 'border-border-default text-fg hover:text-fg-secondary'
                                        : 'border-border-default text-fg-muted hover:text-fg'
                                        }`}
                                >
                                    Single-key shortcuts: {singleKeyShortcuts ? 'On' : 'Off'}
                                </button>
                                <p className="text-fg-secondary text-xs leading-relaxed">
                                    Turn these off if they conflict with speech input or other
                                    tools. Space, Enter and Escape keep working.
                                </p>
                            </div>
                        )}
                    </HelpSection>
                )}

                {/* Drum Sounds */}
                <HelpSection title="Drum Sounds">
                    <div className="flex flex-col md:flex-row gap-4 md:gap-6 items-start">
                        <div className="flex items-center gap-2 m-auto flex-shrink-0">
                            <div className="w-8 h-8 flex items-center justify-center bg-surface-5 text-fg-muted">
                                <Icon id="kit" className="w-4 h-4" />
                            </div>
                        </div>
                        <p className="text-fg-secondary text-xs md:text-sm leading-relaxed">
                            Click the kit button to switch drum sounds — on the setup screen or
                            from the toolbar. The chosen kit loads on demand and swaps in
                            <span className="text-fg"> seamlessly</span>, even mid-playback; a small
                            ring shows download progress. Your choice is remembered and travels with
                            shared links. Kits: <span className="text-fg">Black Pearl</span> and
                            <span className="text-fg"> Red Zeppelin</span>.
                        </p>
                    </div>
                </HelpSection>

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
                            <span className="text-[11px] font-mono text-fg-muted uppercase">
                                {['Small', 'Medium', 'Large'][demoZoom]}
                            </span>
                        </div>
                        <p className="text-fg-secondary text-xs md:text-sm leading-relaxed">
                            Tap the zoom button to cycle through three sizes.
                            Use <span className="text-fg font-mono text-[11px] bg-surface-5 px-1.5 py-0.5 mx-0.5">small</span> to
                            see more measures, <span className="text-fg font-mono text-[11px] bg-surface-5 px-1.5 py-0.5 mx-0.5">large</span> for
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
                                <span className="text-[11px] font-mono text-success">ON</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-8 h-8 flex items-center justify-center bg-surface-5 text-fg-muted">
                                    <Icon id="unfollow" className="w-4 h-4" />
                                </div>
                                <span className="text-[11px] font-mono text-fg-muted">OFF</span>
                            </div>
                        </div>
                        <p className="text-fg-secondary text-xs md:text-sm leading-relaxed">
                            When <span className="text-fg">ON</span>, the view follows the playhead automatically.
                            This button only appears when your pattern is wide enough to scroll.
                            Manually scrolling will turn it off.
                        </p>
                    </div>
                </HelpSection>

                {/* Humanize */}
                <HelpSection title="Humanize (AI)">
                    <div className="flex flex-col md:flex-row gap-4 md:gap-6 items-start">
                        <div className="flex items-center gap-3 m-auto flex-shrink-0">
                            <div className="w-8 h-8 flex items-center justify-center bg-surface-inverted text-fg-on-inverted shadow-[0_0_12px_color-mix(in_srgb,var(--color-highlight)_30%,transparent)]">
                                <Icon id="humanize" className="w-4 h-4" />
                            </div>
                            <span className="text-[11px] font-mono text-success">ON</span>
                        </div>
                        <p className="text-fg-secondary text-xs md:text-sm leading-relaxed">
                            Click to run a trained AI groove model (GrooVAE) entirely in your browser,
                            adding human-like <span className="text-fg">velocity</span> and
                            micro-<span className="text-fg">timing</span> to the quantized grid.
                            The button lights up when humanized; edit the grid and it shows a
                             <span className="text-fg"> !</span> while it re-humanizes after a short pause. Click the lit
                            button to remove it (non-destructive: you get the exact flat pattern back).
                            <span className="text-fg font-mono text-[11px] bg-surface-5 px-1 py-0.5">h</span> does
                            the same. Available for 16th-note time signatures (4/4, 3/4, 5/4).
                        </p>
                    </div>
                    <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border-dim">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-sm bg-primary" />
                            <span className="text-fg-secondary text-xs">Active</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="relative w-8 h-8 rounded-sm bg-accent">
                                <Icon id="humanize" className="pointer-events-none absolute bottom-0 right-0 w-[45%] h-[45%] text-accent-mark" />
                            </div>
                            <span className="text-fg-secondary text-xs">Humanized</span>
                        </div>
                        <p className="text-fg-secondary text-xs leading-relaxed flex-1">
                            Humanized steps carry a small mark in the corner, so you can tell them
                            apart without relying on colour.
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
                                <div className="text-[11px] font-mono text-fg-dim text-left mt-1 ml-1.5 animate-pulse">↑ long press</div>
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
                                <span className="text-[11px] font-mono text-fg uppercase">Repeat</span>
                                <span className="text-[11px] text-fg-muted">Fill every matching beat</span>
                            </div>
                            <div className="bg-surface-0 border border-border-dim p-3 flex flex-col items-center gap-2">
                                <div className="flex items-center gap-0.5">
                                    <MiniPad active /><MiniPad /><MiniPad /><MiniPad />
                                    <div className="w-1" />
                                    <MiniPad clearing /><MiniPad /><MiniPad /><MiniPad />
                                </div>
                                <span className="text-[11px] font-mono text-fg uppercase">Alternate</span>
                                <span className="text-[11px] text-fg-muted">Every other group</span>
                            </div>
                            <div className="bg-surface-0 border border-border-dim p-3 flex flex-col items-center gap-2">
                                <div className="flex items-center gap-0.5">
                                    <MiniPad clearing /><MiniPad /><MiniPad /><MiniPad />
                                    <div className="w-1" />
                                    <MiniPad clearing /><MiniPad /><MiniPad /><MiniPad />
                                </div>
                                <span className="text-[11px] font-mono text-fg uppercase">Clear</span>
                                <span className="text-[11px] text-fg-muted">Remove from all beats</span>
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
                                    <span className="text-lg font-bold text-danger">−</span>
                                </div>
                            </div>
                            <div className="text-fg-secondary text-xs md:text-sm leading-relaxed">
                                <p className="mb-2">
                                    When you have more than one measure, a <span className="text-danger">delete bar</span> appears below the grid.
                                    Tap a measure's bar to start deletion.
                                </p>
                                <p>
                                    A confirmation prompt will appear with
                                    {' '}<span className="text-[11px] font-mono font-bold text-danger bg-danger/10 border border-danger/30 px-1.5 py-0.5">Yes</span>{' '}
                                    and
                                    {' '}<span className="text-[11px] font-mono text-fg-secondary bg-highlight/5 border border-highlight/10 px-1.5 py-0.5">No</span>{' '}
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
                    <div className="flex flex-wrap gap-2 text-[11px] font-mono text-fg-secondary uppercase justify-center mb-3">
                        <span className="bg-surface-0 px-2 py-1 border border-border-dim">Tone.js</span>
                        <span className="bg-surface-0 px-2 py-1 border border-border-dim">React 19</span>
                        <span className="bg-surface-0 px-2 py-1 border border-border-dim">Tailwind CSS</span>
                        <span className="bg-surface-0 px-2 py-1 border border-border-dim">Vite</span>
                        <span className="bg-surface-0 px-2 py-1 border border-border-dim">AV Linux Drumkits (Black Pearl, Red Zeppelin)</span>
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
