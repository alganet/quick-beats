// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import React from 'react';
import { COMMON_SIGNATURES } from '../data/signatures';
import { Icon } from './Icons';

export default function Setup({ onSelect, onConfirm, selectedSig, onShowHelp }) {
    return (
        <div className="min-h-screen w-full flex flex-col items-center justify-start md:justify-center bg-[#0a0a0a] p-6 overflow-y-auto py-12 md:py-6 relative">
            <button
                onClick={onShowHelp}
                className="absolute top-4 right-6 text-slate-700 hover:text-white transition-colors font-mono text-[10px] uppercase tracking-tighter"
            >
                v1.0.0
            </button>
            <div className="max-w-2xl w-full">
                <div className="text-center mb-8 md:mb-16">
                    <h1 className="text-6xl font-black tracking-tighter text-white mb-4 uppercase flex items-center justify-center gap-4">
                        <Icon id="logo" className="w-12 h-12 text-[#3b82f6]" />
                        Quick Beats
                    </h1>
                    <p className="text-slate-500 text-sm font-mono uppercase tracking-[0.2em]">Select Tempo & Preview</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {COMMON_SIGNATURES.map((sig) => {
                        const isSelected = selectedSig?.name === sig.name;
                        return (
                            <button
                                key={sig.name}
                                onClick={() => onSelect(sig)}
                                className={`group relative flex flex-col items-start p-6 rounded-none bg-[#141414] border transition-all text-left ${isSelected ? 'border-[#3b82f6] ring-1 ring-[#3b82f6]' : 'border-[#333] hover:border-slate-500'
                                    }`}
                            >
                                <div className="flex items-center justify-between w-full mb-2">
                                    <span className={`text-3xl font-bold transition-colors ${isSelected ? 'text-[#3b82f6]' : 'text-white'}`}>
                                        {sig.name}
                                    </span>
                                    <span className={`px-2 py-0.5 border text-[9px] uppercase tracking-widest font-mono ${isSelected ? 'border-[#3b82f6] text-[#3b82f6]' : 'border-[#333] text-slate-500'
                                        }`}>
                                        {sig.label}
                                    </span>
                                </div>
                                <p className="text-slate-600 text-xs font-mono lowercase">{sig.description}</p>
                                {isSelected && (
                                    <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-[#3b82f6] animate-pulse" />
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Confirm Button Area */}
                <div className="mt-12 h-16 flex items-center justify-center">
                    {selectedSig && (
                        <button
                            onClick={onConfirm}
                            className="w-full md:w-64 bg-[#3b82f6] text-white font-black py-4 hover:bg-[#2563eb] transition-all tracking-[0.3em] uppercase text-sm animate-in fade-in slide-in-from-bottom-2 duration-300"
                        >
                            Confirm & Start
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
