// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import React from 'react';
import { Icon } from './Icons';

export default function Help({ isOpen, onClose }) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[110] flex flex-col items-center justify-start p-4 bg-[#0a0a0a] overflow-y-auto">
            <div className="max-w-2xl w-full pb-12 pt-4 md:pt-12">
                <div className="flex items-center justify-between mb-12 border-b border-[#1e1e1e] pb-6">
                    <div>
                        <h1 className="text-4xl font-black tracking-tighter text-white uppercase">Quick Beats</h1>
                        <p className="text-slate-500 font-mono text-xs uppercase tracking-widest mt-1">v1.0.0</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-500 hover:text-white transition-colors border border-[#333] px-4 py-2 uppercase font-mono text-[10px] tracking-widest"
                    >
                        Close [ESC]
                    </button>
                </div>

                <section className="mb-12">
                    <h2 className="text-[#3b82f6] text-xs font-black uppercase tracking-[0.3em] mb-4">About the Project</h2>
                    <p className="text-slate-400 text-sm leading-relaxed mb-4">
                        Quick Beats is a minimalist drum machine designed for rapid sketching of rhythmic patterns.
                        It focuses on low latency, intuitive sequencing, and zero-friction sharing of musical ideas.
                    </p>
                    <p className="text-slate-400 text-sm leading-relaxed">
                        Every pattern you create is automatically encoded into the browser's address bar. Simply copy and share the URL
                        to send your full arrangement, tempo, and kit configuration to anyone instantly.
                    </p>
                </section>

                <section className="mb-12">
                    <h2 className="text-[#3b82f6] text-xs font-black uppercase tracking-[0.3em] mb-6">Core Components</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-[#141414] border border-[#333] p-6">
                            <h3 className="text-white text-xs font-black uppercase mb-2">Tone.js</h3>
                            <p className="text-slate-500 text-[11px] leading-relaxed">
                                The heart of the application. Handles high-precision timing, audio scheduling, and sample playback with hardware-level consistency.
                            </p>
                        </div>
                        <div className="bg-[#141414] border border-[#333] p-6">
                            <h3 className="text-white text-xs font-black uppercase mb-2">React 19</h3>
                            <p className="text-slate-500 text-[11px] leading-relaxed">
                                Provides the reactive state management engine for the grid, controls, and URL synchronization.
                            </p>
                        </div>
                        <div className="bg-[#141414] border border-[#333] p-6">
                            <h3 className="text-white text-xs font-black uppercase mb-2">Tailwind CSS</h3>
                            <p className="text-slate-500 text-[11px] leading-relaxed">
                                Powers the "Neon Dark" design system, ensuring a premium high-contrast interface that is fully responsive.
                            </p>
                        </div>
                        <div className="bg-[#141414] border border-[#333] p-6">
                            <h3 className="text-white text-xs font-black uppercase mb-2">Vite</h3>
                            <p className="text-slate-500 text-[11px] leading-relaxed">
                                Modern frontend tooling that enables sub-millisecond hot module replacement and optimized production builds.
                            </p>
                        </div>
                    </div>
                </section>
                <section className="mb-12">
                    <h2 className="text-[#3b82f6] text-xs font-black uppercase tracking-[0.3em] mb-4">Sound Library</h2>
                    <div className="bg-[#141414] border border-[#333] p-6">
                        <h3 className="text-white text-xs font-black uppercase mb-2">AV Linux Black Pearl</h3>
                        <p className="text-slate-500 text-sm leading-relaxed">
                            The drum sounds are powered by the <a href="http://www.bandshed.net/avldrumkits" className="text-slate-300">AV Linux Black Pearl</a> toolkit.
                            A high-quality multi-sampled acoustic drum kit that provides the organic punch and depth
                            essential for realistic rhythmic foundations.
                        </p>
                    </div>
                </section>

                <section className="mb-12">
                    <h2 className="text-[#3b82f6] text-xs font-black uppercase tracking-[0.3em] mb-4">License Information</h2>
                    <div className="bg-[#0f0f0f] border-l-2 border-[#3b82f6] p-4 overflow-x-auto">
                        <pre className="text-slate-400 text-[10px] md:text-[11px] font-mono leading-relaxed italic whitespace-pre-wrap">
                            {`ISC License:

Copyright (c) 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND ISC DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL ISC BE LIABLE FOR ANY
SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.`}
                        </pre>
                    </div>
                </section>

                <div className="text-center pt-8 border-t border-[#1e1e1e]">
                    <button
                        onClick={onClose}
                        className="w-full md:w-64 bg-white text-black font-black py-4 hover:bg-slate-200 transition-all tracking-[0.3em] uppercase text-xs"
                    >
                        Back
                    </button>
                </div>
            </div>
        </div>
    );
}
