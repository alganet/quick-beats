// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import React from "react";
import { Icon } from "./Icons";

export default function Controls({ isPlaying, togglePlay, bpm, setBpm }) {

    return (
        <div className="flex flex-row items-center gap-4 md:gap-8 mb-4 p-3 bg-[#141414] border border-[#333]">
            {/* Buttons Group: Left */}
            <div className="flex items-center gap-2 md:gap-3">
                {/* Play/Stop Button */}
                <button
                    onClick={togglePlay}
                    className={`w-10 h-10 flex-shrink-0 flex items-center justify-center transition-all ${isPlaying
                        ? "bg-[#ff3e3e] text-white"
                        : "bg-[#22c55e] text-white"
                        } hover:scale-105 active:scale-95`}
                    title={isPlaying ? "Stop" : "Play"}
                    aria-label={isPlaying ? "Stop" : "Play"}
                >
                    <Icon id={isPlaying ? "stop" : "play"} className="w-5 h-5" />
                </button>
            </div>

            {/* Tempo Slider: Right / Auto-filling middle space */}
            <div className="flex-1 flex items-center justify-end gap-3 md:gap-6 ml-auto">
                <div className="flex flex-col items-end gap-0.5 min-w-[50px] md:min-w-[60px]">
                    <span className="text-[8px] md:text-[9px] font-mono uppercase text-slate-500 tracking-tighter">Tempo</span>
                    <span className="text-white text-[10px] font-mono leading-none tracking-tighter">{bpm} <span className="hidden md:inline">BPM</span></span>
                </div>

                <div className="w-full max-w-[100px] md:max-w-[200px]">
                    <input
                        type="range"
                        min="60"
                        max="200"
                        value={bpm}
                        onChange={(e) => setBpm(parseInt(e.target.value))}
                        className="w-full h-1 bg-[#1e1e1e] appearance-none cursor-pointer accent-[#3b82f6]"
                    />
                </div>
            </div>
        </div>
    );
}
