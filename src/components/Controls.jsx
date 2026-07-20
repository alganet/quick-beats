// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC


import { useCallback, useEffect, useRef } from "react";
import { Icon } from "./Icons";
import HumanizeButton from "./HumanizeButton";
import DrumKitButton from "./DrumKitButton";
import { MIN_BPM, MAX_BPM, clampBpm } from "../data/sequencerConfig";

const ACTION_DELAY_MS = 200;

export default function Controls({
    isPlaying, togglePlay, bpm, setBpm, autoScroll, setAutoScroll, canScroll, zoom, setZoom,
    humanizeStatus, humanizeProgress, onHumanize,
    kits, activeKit, switchingKit, kitProgress, onSelectKit,
}) {
    const zoomToggleTimeoutRef = useRef(null);
    const autoScrollToggleTimeoutRef = useRef(null);

    useEffect(() => {
        return () => {
            if (zoomToggleTimeoutRef.current) {
                clearTimeout(zoomToggleTimeoutRef.current);
            }
            if (autoScrollToggleTimeoutRef.current) {
                clearTimeout(autoScrollToggleTimeoutRef.current);
            }
        };
    }, []);

    const scheduleZoomToggle = useCallback(() => {
        if (zoomToggleTimeoutRef.current) {
            clearTimeout(zoomToggleTimeoutRef.current);
        }

        zoomToggleTimeoutRef.current = setTimeout(() => {
            zoomToggleTimeoutRef.current = null;
            setZoom((currentZoom) => (currentZoom + 1) % 3);
        }, ACTION_DELAY_MS);
    }, [setZoom]);

    const scheduleAutoScrollToggle = useCallback(() => {
        if (autoScrollToggleTimeoutRef.current) {
            clearTimeout(autoScrollToggleTimeoutRef.current);
        }

        autoScrollToggleTimeoutRef.current = setTimeout(() => {
            autoScrollToggleTimeoutRef.current = null;
            setAutoScroll((isAutoScrollEnabled) => !isAutoScrollEnabled);
        }, ACTION_DELAY_MS);
    }, [setAutoScroll]);


    return (
        <div className="flex flex-row items-center gap-0 mb-2 p-0 short-landscape:mb-1">
            {/* Buttons Group: Left */}
            <div className="flex items-center gap-3 mr-2">
                {/* Play/Stop Button */}
                <button
                    onClick={togglePlay}
                    className={`w-10 h-10 flex-shrink-0 flex items-center justify-center transition-all rounded-sm ${isPlaying
                        ? "bg-danger text-fg"
                        : "bg-success text-fg"
                        }`}
                    title={isPlaying ? "Stop [P]" : "Play [P]"}
                    aria-label={isPlaying ? "Stop" : "Play"}
                >
                    <Icon id={isPlaying ? "stop" : "play"} className="w-5 h-5" />
                </button>

                <div className="flex items-center gap-1 bg-surface-5 rounded-sm mr-1">

                    <div className="text-fg-muted flex flex-col select-none inline-block leading-1 border-r-2 border-surface-1 px-1 h-8">
                        <div className="text-[10px] font-bold font-mono uppercase m-2 text-center">{bpm}</div>
                        <div className="text-[10px] font-mono m-2">BPM</div>
                    </div>
                    {/* aria-labels because name-from-content would be the raw
                        punctuation glyphs — "minus, button" — and title never
                        becomes the accessible name when content exists. */}
                    <button
                        title="Decrease BPM [-]"
                        aria-label="Decrease BPM"
                        className="hover:text-fg text-fg-muted text-sm min-w-6 w-6 h-6 pl-1 text-center"
                        onClick={() => setBpm(clampBpm(bpm - 1))}
                    >−</button>
                    <div className="tempo-input-wrapper h-8 w-auto">
                    <input
                            type="range"
                            min={MIN_BPM}
                            max={MAX_BPM}
                            value={bpm}
                            aria-label="Tempo"
                            aria-valuetext={`${bpm} BPM`}
                            onChange={(e) => setBpm(parseInt(e.target.value))}
                            className="tempo-input mt-1.5 pl-1"
                    />
                    </div>
                    <button
                        title="Increase BPM [+]"
                        aria-label="Increase BPM"
                        className="hover:text-fg text-fg-muted text-sm min-w-6 w-6 h-6 pr-1 text-center"
                        onClick={() => setBpm(clampBpm(bpm + 1))}
                    >＋</button>
                </div>
            </div>

            {/* Controls Group: Right */}
            <div className="flex-1 flex items-center justify-end gap-3 ml-0">

                {/* Drum-sound switcher (on-demand, gapless) */}
                <DrumKitButton
                    kits={kits}
                    activeKit={activeKit}
                    switchingTo={switchingKit}
                    progress={kitProgress}
                    onSelectKit={onSelectKit}
                />

                {/* Humanize toggle (off / on / pending) */}
                <HumanizeButton status={humanizeStatus} progress={humanizeProgress} onClick={onHumanize} />

                {/* Zoom Toggle */}
                <button
                    onClick={scheduleZoomToggle}
                    className="flex-none w-8 h-8 flex items-center rounded-sm justify-center transition-all bg-surface-5 text-fg-secondary hover:text-fg"
                    title={`Change Zoom Level [z]`}
                    aria-label={`Zoom: ${['small', 'medium', 'large'][zoom] ?? zoom}`}
                >
                    <Icon id={`zoom-${zoom}`} className="w-4 h-4" />
                </button>
                {/* Auto-scroll Toggle - Only visible when scrolling is possible */}
                {canScroll && isPlaying && (
                    <button
                        onClick={scheduleAutoScrollToggle}
                        className={`flex-none w-8 h-8 flex items-center rounded-sm justify-center transition-all ${autoScroll
                            ? "bg-surface-inverted text-fg-on-inverted shadow-[0_0_12px_color-mix(in_srgb,var(--color-highlight)_30%,transparent)]"
                            : "bg-surface-5 text-fg-muted hover:text-fg-secondary"
                            }`}
                        title={autoScroll ? "Auto-scroll ON [s]" : "Auto-scroll OFF [s]"}
                        aria-label="Auto-scroll"
                        aria-pressed={autoScroll}
                    >
                        <Icon id={autoScroll ? "follow" : "unfollow"} className="w-4 h-4" />
                    </button>
                )}
            </div>
        </div>
    );
}
