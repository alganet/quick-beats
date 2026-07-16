// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC


import { COMMON_SIGNATURES } from '../data/signatures';
import { Icon } from './Icons';
import DrumKitButton from './DrumKitButton';

export default function Setup({
    onSelect, onConfirm, selectedSig, onShowHelp,
    kits, activeKit, switchingKit, kitProgress, onSelectKit,
}) {
    return (
        <div className="min-w-[360px] z-40 min-h-dvh w-full flex flex-col items-center justify-start md:justify-center bg-surface-0 safe-px-6 overflow-y-auto py-12 md:py-6 relative short-landscape:h-dvh short-landscape:overflow-y-hidden short-landscape:justify-center">
            <button
                onClick={onShowHelp}
                className="absolute top-4 right-6 text-fg-faint hover:text-fg transition-colors font-mono text-[10px] uppercase tracking-tighter"
            >
                v{__APP_VERSION__}
            </button>
            {/* Short landscape splits this into two columns: branding and the
                confirm action stay fixed on the left while only the signature
                grid scrolls, so a ~390px-tall phone never loses the call to
                action off the bottom of the screen. */}
            <div className="max-w-2xl w-full short-landscape:max-w-none short-landscape:h-full short-landscape:flex short-landscape:flex-row short-landscape:items-center short-landscape:gap-8">
                {/* Proportional rather than a fixed 16rem: on a 568px-wide phone
                    (an SE sideways) a fixed column would eat 45% of the width and
                    crush the signature cards. The cap keeps it at 16rem once
                    there's room, so wider phones are unaffected. */}
                <div className="short-landscape:w-1/3 short-landscape:max-w-64 short-landscape:shrink-0 short-landscape:flex short-landscape:flex-col short-landscape:justify-center">
                    <div className="text-center mb-8 md:mb-16 short-landscape:text-left short-landscape:mb-0">
                        <h1 className="text-3xl font-black tracking-tighter text-fg mb-4 uppercase flex items-center justify-center gap-3 short-landscape:justify-start">
                            <Icon id="logo" className="w-12 h-12 short-landscape:w-9 short-landscape:h-9" />
                            Quick Beats
                        </h1>
                        <p className="text-fg-muted text-sm font-mono uppercase tracking-[0.2em]">Select Tempo & Preview</p>

                        {/* Drum-sound picker — the preview plays the chosen kit */}
                        {onSelectKit && (
                            <div className="flex items-center justify-center gap-2 mt-5 short-landscape:justify-start short-landscape:mt-4">
                                <span className="text-fg-faint text-[10px] font-mono uppercase tracking-[0.2em]">Drum Kit</span>
                                {/* The popover hangs off the button's right edge, which fits while
                                    this sits centred in portrait. In short-landscape the button moves
                                    to the left edge of the branding column, where that would open
                                    off-screen — so anchor it the other way round. */}
                                <DrumKitButton
                                    kits={kits}
                                    activeKit={activeKit}
                                    switchingTo={switchingKit}
                                    progress={kitProgress}
                                    onSelectKit={onSelectKit}
                                    menuClassName="right-0 short-landscape:right-auto short-landscape:left-0"
                                    arrowClassName="right-3 short-landscape:right-auto short-landscape:left-3"
                                />
                            </div>
                        )}
                    </div>

                    {/* Confirm Button Area — a gradient bar pinned to the bottom
                        when stacked, a plain in-flow button in the left column
                        when short-landscape (where mt-6 finally applies).

                        The z-50 belongs here, on the fixed element, and not on
                        the button: `position: fixed` always opens a stacking
                        context, so a z-index inside this bar can only order it
                        against its own siblings — it cannot lift the button over
                        the signature cards, which are positioned too and come
                        later in the document. Without a z-index of its own the
                        bar loses that tie on DOM order and the cards scroll over
                        the button, swallowing the tap that was meant to start
                        playing. Inert once short-landscape makes this static,
                        which is fine: in flow there is nothing to overlap. */}
                    <div className="fixed bottom-0 w-full left-0 z-50 mt-6 flex items-center justify-center p-4 pt-20 bg-gradient-to-t from-surface-0 to-transparent pointer-events-none short-landscape:static short-landscape:w-auto short-landscape:p-0 short-landscape:pt-0 short-landscape:bg-none short-landscape:pointer-events-auto short-landscape:justify-start">
                        {/* short-landscape:w-full wins over md:w-64 (it is emitted later),
                            keeping the button inside a branding column narrower than 16rem. */}
                        {selectedSig && (
                            <button
                                onClick={onConfirm}
                                className="w-full md:w-64 bg-primary text-fg font-black py-4 hover:bg-primary-hover transition-all tracking-[0.3em] uppercase text-sm pointer-events-auto short-landscape:w-full"
                            >
                                Confirm & Start
                            </button>
                        )}
                    </div>
                </div>

                {/* items-center on the row sizes this to its content and centres
                    it against the branding column, while max-h-full keeps a
                    longer signature list scrolling from the top rather than
                    centring its overflow out of reach. */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-16 short-landscape:grid-cols-2 short-landscape:mb-0 short-landscape:flex-1 short-landscape:max-h-full short-landscape:content-start short-landscape:overflow-y-auto">
                    {COMMON_SIGNATURES.map((sig) => {
                        const isSelected = selectedSig?.name === sig.name;
                        return (
                            <button
                                key={sig.name}
                                onClick={() => onSelect(sig)}
                                className={`group relative flex flex-col items-start p-6 rounded-none bg-surface-2 border transition-all text-left short-landscape:p-4 ${isSelected ? 'border-accent ring-1 ring-accent' : 'border-border-default hover:border-fg-muted'
                                    }`}
                            >
                                <div className="flex items-center justify-between w-full mb-2">
                                    <span className={`text-3xl font-bold transition-colors short-landscape:text-2xl ${isSelected ? 'text-accent' : 'text-fg'}`}>
                                        {sig.name}
                                    </span>
                                    <span className={`px-2 py-0.5 border text-[9px] uppercase tracking-widest font-mono ${isSelected ? 'border-accent text-accent' : 'border-border-default text-fg-muted'
                                        }`}>
                                        {sig.label}
                                    </span>
                                </div>
                                <p className="text-fg-dim text-xs font-mono lowercase">{sig.description}</p>
                                {isSelected && (
                                    <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
