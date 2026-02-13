// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { useState } from 'react';
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

                <p className="text-slate-400 text-[10px] font-mono uppercase tracking-widest mb-4">
                    Instantly share with one click:
                </p>

                <div className="grid grid-cols-3 gap-2 mb-6">
                    {[
                        { id: 'x', label: 'X', color: 'hover:bg-slate-800', url: `https://twitter.com/intent/tweet?text=Check out this beat I made on Quick Beats!&url=${encodeURIComponent(shareUrl)}` },
                        { id: 'whatsapp', label: 'WhatsApp', color: 'hover:bg-green-600', url: `https://api.whatsapp.com/send?text=${encodeURIComponent(`Check out this beat I made on Quick Beats! ${shareUrl}`)}` },
                        { id: 'telegram', label: 'Telegram', color: 'hover:bg-sky-500', url: `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent('Check out this beat I made on Quick Beats!')}` }
                    ].map((platform) => (
                        <a
                            key={platform.id}
                            href={platform.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`flex flex-col items-center justify-center gap-2 p-3 border border-[#333] ${platform.color} transition-all group`}
                        >
                            <Icon id={platform.id} className="w-5 h-5 text-slate-400 group-hover:text-white" />
                            <span className="text-[9px] font-mono uppercase tracking-tighter text-slate-500 group-hover:text-white">{platform.label}</span>
                        </a>
                    ))}
                </div>

                <div className="pt-6 border-t border-[#1e1e1e]">
                    <p className="text-slate-500 text-[9px] font-mono uppercase tracking-tighter mb-3">Or copy the direct link:</p>
                    <div className="flex gap-1">
                        <div className="flex-1 bg-[#0a0a0a] border border-[#333] px-3 py-1.5 text-[10px] font-mono text-slate-400 truncate flex items-center">
                            {shareUrl}
                        </div>
                        <button
                            onClick={handleCopy}
                            className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-widest transition-all ${copied ? 'bg-green-600 text-white' : 'bg-[#1e1e1e] text-slate-400 hover:text-white hover:bg-[#333]'
                                }`}
                        >
                            {copied ? 'Copied' : 'Copy'}
                        </button>
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
