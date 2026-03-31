// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC


import { COMMON_SIGNATURES } from '../data/signatures';
import { Icon } from './Icons';

export default function Setup({ onSelect, onConfirm, selectedSig, onShowHelp }) {
    return (
        <div className="min-w-[360px] z-40 min-h-screen w-full flex flex-col items-center justify-start md:justify-center bg-surface-0 p-6 overflow-y-auto py-12 md:py-6 relative">
            <button
                onClick={onShowHelp}
                className="absolute top-4 right-6 text-fg-faint hover:text-fg transition-colors font-mono text-[10px] uppercase tracking-tighter"
            >
                v1.2.7
            </button>
            <div className="max-w-2xl w-full">
                <div className="text-center mb-8 md:mb-16">
                    <h1 className="text-3xl font-black tracking-tighter text-fg mb-4 uppercase flex items-center justify-center gap-3">
                        <Icon id="logo" className="w-12 h-12" />
                        Quick Beats
                    </h1>
                    <p className="text-fg-muted text-sm font-mono uppercase tracking-[0.2em]">Select Tempo & Preview</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-16">
                    {COMMON_SIGNATURES.map((sig) => {
                        const isSelected = selectedSig?.name === sig.name;
                        return (
                            <button
                                key={sig.name}
                                onClick={() => onSelect(sig)}
                                className={`group relative flex flex-col items-start p-6 rounded-none bg-surface-2 border transition-all text-left ${isSelected ? 'border-accent ring-1 ring-accent' : 'border-border-default hover:border-fg-muted'
                                    }`}
                            >
                                <div className="flex items-center justify-between w-full mb-2">
                                    <span className={`text-3xl font-bold transition-colors ${isSelected ? 'text-accent' : 'text-fg'}`}>
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

                {/* Confirm Button Area */}
                <div className="absolute mt-6 flex items-center justify-center fixed bottom-0 w-full left-0 p-4 pt-20 bg-gradient-to-t from-surface-0 to-transparent pointer-events-none">
                    {selectedSig && (
                        <button
                            onClick={onConfirm}
                            className="z-50 relative w-full md:w-64 bg-primary text-fg font-black py-4 hover:bg-primary-hover transition-all tracking-[0.3em] uppercase text-sm animate-in fade-in slide-in-from-bottom-2 duration-300 pointer-events-auto"
                        >
                            Confirm & Start
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
