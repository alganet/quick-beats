// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { Icon } from './Icons';

export default function ErrorModal({ isOpen, onGoHome }) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in fade-in duration-200">
            <div
                className="w-full max-w-md bg-[#141414] border border-red-900/50 p-8 shadow-2xl animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex flex-col items-center text-center mb-8">
                    <div className="w-16 h-16 mb-6 rounded-full bg-red-900/20 flex items-center justify-center">
                        <Icon id="logo" className="w-10 h-10 text-red-400" />
                    </div>
                    <h2 className="text-2xl font-black tracking-tighter text-white uppercase mb-2">
                        Oops...
                    </h2>
                    <p className="text-slate-400 text-sm leading-relaxed">
                        Something unexpected happened. Click below to refresh the app and start fresh.
                    </p>
                </div>

                <button
                    onClick={onGoHome}
                    className="w-full py-4 bg-red-600 hover:bg-red-500 text-white text-xs font-black uppercase tracking-widest transition-all"
                >
                    Go Home & Refresh
                </button>
            </div>
        </div>
    );
}
