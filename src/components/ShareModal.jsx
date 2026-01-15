// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import React, { useState } from 'react';
import { Icon } from './Icons';

export default function ShareModal({ isOpen, onClose, shareUrl }) {
    const [copied, setCopied] = useState(false);

    if (!isOpen) return null;

    const handleCopy = () => {
        navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div
                className="w-full max-w-md bg-[#141414] border border-[#333] p-6 shadow-2xl animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-black tracking-tighter text-white uppercase">Share Beat</h2>
                    <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
                        <span className="text-2xl">&times;</span>
                    </button>
                </div>

                <p className="text-slate-400 text-xs font-mono uppercase tracking-widest mb-4">
                    Link generated with tempo and pattern data:
                </p>

                <div className="flex gap-2 mb-6">
                    <div className="flex-1 bg-[#0a0a0a] border border-[#333] px-3 py-2 text-[10px] font-mono text-slate-300 truncate">
                        {shareUrl}
                    </div>
                    <button
                        onClick={handleCopy}
                        className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${copied ? 'bg-green-600 text-white' : 'bg-[#3b82f6] text-white hover:bg-[#2563eb]'
                            }`}
                    >
                        {copied ? 'Copied' : 'Copy'}
                    </button>
                </div>

                <div className="space-y-4">
                    <div className="flex items-start gap-3">
                        <div className="w-5 h-5 flex-shrink-0 flex items-center justify-center rounded-full bg-[#1e1e1e] text-[10px] font-bold text-[#3b82f6]">1</div>
                        <p className="text-xs text-slate-400 leading-relaxed">Copy the link above to share your specific tempo, time signature, and arrangement.</p>
                    </div>
                    <div className="flex items-start gap-3">
                        <div className="w-5 h-5 flex-shrink-0 flex items-center justify-center rounded-full bg-[#1e1e1e] text-[10px] font-bold text-[#3b82f6]">2</div>
                        <p className="text-xs text-slate-400 leading-relaxed">Anyone with the link can open the pattern directly in their browser—no login required.</p>
                    </div>
                </div>

                <button
                    onClick={onClose}
                    className="w-full mt-8 py-3 border border-[#333] text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white hover:border-white transition-all"
                >
                    Close
                </button>
            </div>
        </div>
    );
}
