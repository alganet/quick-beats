// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import React from "react";
import { Icon } from "./Icons";

export default function Controls({ isPlaying, togglePlay, bpm, setBpm, autoScroll, setAutoScroll, canScroll, zoom, setZoom }) {

    return (
        <div className="flex flex-row items-center gap-4 md:gap-8 mb-2 p-0 max-w-[400px]">
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

            {/* Controls Group: Right */}
            <div className="flex-1 flex items-center justify-end gap-3 ml-auto">

                <div className="flex flex-col items-end gap-0.5 min-w-[20px] md:min-w-[20px] select-none">
                    <span className="text-white text-[10px] font-mono leading-none tracking-tighter">{bpm} BPM</span>
                </div>

                <div className="w-full mr-2">
                    <input
                        type="range"
                        min="60"
                        max="200"
                        value={bpm}
                        onChange={(e) => setBpm(parseInt(e.target.value))}
                        className="custom-slider"
                    />
                </div>

                {/* Auto-scroll Toggle - Only visible when scrolling is possible */}
                {canScroll && (
                    <button
                        onClick={() => setAutoScroll(!autoScroll)}
                        className={`flex-none w-8 h-8 flex items-center justify-center transition-all rounded-md ${autoScroll
                            ? "bg-white text-[#0a0a0a] shadow-[0_0_12px_rgba(255,255,255,0.3)]"
                            : "bg-[#222] text-slate-500 hover:text-slate-300"
                            } hover:scale-105 active:scale-95`}
                        title={autoScroll ? "Auto-scroll ON" : "Auto-scroll OFF"}
                        aria-label="Toggle auto-scroll"
                    >
                        <Icon id={autoScroll ? "follow" : "unfollow"} className="w-4 h-4" />
                    </button>
                )}
                {/* Zoom Toggle */}
                <button
                    onClick={() => setZoom((zoom + 1) % 3)}
                    className="flex-none w-8 h-8 flex items-center justify-center transition-all rounded-md bg-[#222] text-slate-400 hover:text-white hover:scale-105 active:scale-95"
                    title="Change Zoom Level"
                    aria-label="Toggle Zoom"
                >
                    <Icon id={`zoom-${zoom}`} className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
}
