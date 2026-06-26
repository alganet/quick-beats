// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { useState, useEffect, useRef, useCallback } from 'react'
import { useTheme } from './hooks/useTheme'
import { useAudio } from './hooks/useAudio'
import { useHumanize } from './hooks/useHumanize'
import { useSamplePreload } from './hooks/useSamplePreload'
import { useHashSync } from './hooks/useHashSync'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useHumanizeLifecycle } from './hooks/useHumanizeLifecycle'
import Sequencer from './components/Sequencer'
import Controls from './components/Controls'
import Setup from './components/Setup'
import LoadingScreen from './components/LoadingScreen'
import ShareModal from './components/ShareModal'
import Help from './components/Help'
import { IconSprite, Icon } from './components/Icons'
import { INSTRUMENTS, KITS, DEFAULT_KIT_ID } from './data/kit'
import { BACKBEATS } from './data/patterns'
import { COMMON_SIGNATURES } from './data/signatures'
import { parseInitialHash } from './utils/hashState';
import {
  calculateBulkUpdate,
  calculateGridWithRemovedMeasure,
  calculateNewMeasure,
  generateGridFromSig,
  toggleGridStep
} from './utils/gridHelpers'

const ACTION_DELAY_MS = 200;

function App() {
  const [theme, , toggleTheme] = useTheme();

  const _initialHash = typeof window !== 'undefined'
    ? parseInitialHash(window.location.hash.substring(1), INSTRUMENTS.length, COMMON_SIGNATURES)
    : null;

  // Which kit to start on: a shared link wins, then the last choice persisted in
  // localStorage, then the default. Validated against KITS so a stale/unknown id
  // can never leave us with no sounds. Resolved once on mount (the hooks below
  // capture it as their initial value) — not re-read on every render.
  const [_preferredKitId] = useState(() => {
    if (_initialHash?.kitId && KITS[_initialHash.kitId]) return _initialHash.kitId;
    try {
      const saved = localStorage.getItem('qb-kit');
      if (saved && KITS[saved]) return saved;
    } catch { /* ignore */ }
    return DEFAULT_KIT_ID;
  });

  const { ready: assetsReady, progress: assetsProgress } = useSamplePreload(_preferredKitId);
  const { isPlaying, currentStep, activeKit, loadKit, togglePlay, setBpm, updateGrid, setStep, playNote, setPerfLayer, setHumanizeEnabled, setHumanizeOptions } = useAudio(_preferredKitId);
  const humanize = useHumanize();
  const bpmApplyTimeoutRef = useRef(null);

  // Drum-kit switch progress (unobtrusive, like humanize): which kit is loading
  // and how far along. The engine swaps gaplessly when loadKit resolves.
  const [switchingKit, setSwitchingKit] = useState(null);
  const [kitProgress, setKitProgress] = useState(0);

  const handleSelectKit = useCallback(async (kitId) => {
    // Ignore the kit already playing, the one already mid-switch (a second click
    // would restart its download and reset progress), and unknown ids.
    if (kitId === activeKit || kitId === switchingKit || !KITS[kitId]) return;
    setSwitchingKit(kitId);
    setKitProgress(0);
    try {
      await loadKit(kitId, setKitProgress);
    } finally {
      // Only clear if a newer switch hasn't already taken over (last-wins).
      setSwitchingKit((prev) => (prev === kitId ? null : prev));
    }
  }, [activeKit, switchingKit, loadKit]);

  const [isSetup, setIsSetup] = useState(_initialHash?.success ? true : false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const [timeSignature, setTimeSignature] = useState(_initialHash?.sig ?? null);
  const [previewSig, setPreviewSig] = useState(_initialHash?.sig ?? null);
  const [bpmInput, setBpmInput] = useState(_initialHash?.bpm ?? 120);
  const [grid, setGrid] = useState(_initialHash?.grid ?? []);
  const [autoScroll, setAutoScroll] = useState(() => {
    const saved = localStorage.getItem('qb-auto-scroll');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [canScroll, setCanScroll] = useState(false);
  const [zoom, setZoom] = useState(() => {
    const saved = localStorage.getItem('qb-zoom');
    return saved !== null ? parseInt(saved, 10) : 1;
  });

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  // Persist UI preferences
  useEffect(() => {
    localStorage.setItem('qb-auto-scroll', JSON.stringify(autoScroll));
  }, [autoScroll]);

  useEffect(() => {
    localStorage.setItem('qb-zoom', zoom.toString());
  }, [zoom]);

  // Remember the chosen kit so it's restored on the next visit.
  useEffect(() => {
    localStorage.setItem('qb-kit', activeKit);
  }, [activeKit]);

  // Global keyboard shortcuts
  const [showKeyboardCheatsheet, setShowKeyboardCheatsheet] = useState(() => {
    try {
      return typeof window !== 'undefined' && window.matchMedia?.('(pointer: fine)')?.matches;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    // update when pointer precision media query changes
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      const mq = window.matchMedia('(pointer: fine)');
      const handler = (ev) => setShowKeyboardCheatsheet(ev.matches);
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
    return undefined;
  }, []);

  // Humanize intent layer: on/off toggle, streamed-layer application, idle
  // re-humanize, BPM rescale, signature-change reset, and derived button status.
  const { humanizeStatus, humanizeActive, humanizedLayer, humanizeAction, modelProgress } = useHumanizeLifecycle({
    grid,
    bpmInput,
    timeSignature,
    isSetup,
    assetsReady,
    setPerfLayer,
    setHumanizeEnabled,
    setHumanizeOptions,
    humanize,
  });

  useKeyboardShortcuts({
    togglePlay,
    setBpmInput,
    setZoom,
    setAutoScroll,
    setIsHelpOpen,
    setIsShareOpen,
    humanizeAction,
  });

  // Keep the URL hash in sync with the live pattern (debounced).
  useHashSync({ isSetup, timeSignature, grid, bpmInput, activeKit });

  // Sync BPM to audio engine on a short delay so UI can update instantly while
  // avoiding excessive tempo updates during rapid user input.
  useEffect(() => {
    if (bpmApplyTimeoutRef.current) {
      clearTimeout(bpmApplyTimeoutRef.current);
    }

    bpmApplyTimeoutRef.current = setTimeout(() => {
      setBpm(bpmInput);
      bpmApplyTimeoutRef.current = null;
    }, ACTION_DELAY_MS);

    return () => {
      if (bpmApplyTimeoutRef.current) {
        clearTimeout(bpmApplyTimeoutRef.current);
      }
    };
  }, [bpmInput, setBpm]);

  // Sync Grid with Audio Engine
  useEffect(() => {
    if (grid.length > 0) {
      updateGrid(grid);
    }
  }, [grid, updateGrid]);

  const handlePreview = (sig) => {
    setPreviewSig(sig);
    const patternData = BACKBEATS[sig.name];

    // Set default tempo for the pattern
    if (patternData?.tempo) {
      setBpmInput(patternData.tempo);
    }

    const newGrid = generateGridFromSig(sig, INSTRUMENTS);
    setGrid(newGrid);
    updateGrid(newGrid);
    if (!isPlaying) togglePlay();
  };

  const handleConfirm = () => {
    setTimeSignature(previewSig);
    setIsSetup(true);
  };

  const handleReset = () => {
    if (isPlaying) togglePlay();
    setIsSetup(false);
    setTimeSignature(null);
    setPreviewSig(null);
    setGrid([]);
    setStep(0);
    // Explicitly clear hash when starting over
    window.history.replaceState(null, '', window.location.pathname);
  };

  const toggleStep = (row, col) => {
    const isActivating = !grid[row][col];
    if (isActivating && !isPlaying) {
      playNote(INSTRUMENTS[row]);
    }

    const newGrid = toggleGridStep(grid, row, col);
    setGrid(newGrid);
  };

  const bulkUpdateStep = useCallback((row, col, mode) => {
    setGrid(prevGrid => calculateBulkUpdate(prevGrid, row, col, mode, timeSignature));

    if (mode !== 'clear') {
      playNote(INSTRUMENTS[row]);
    }
  }, [timeSignature, playNote]);
  const addMeasure = () => {
    setGrid(prevGrid => calculateNewMeasure(prevGrid, timeSignature));
  };

  const removeMeasure = (measureIndex) => {
    setGrid(prevGrid => calculateGridWithRemovedMeasure(prevGrid, measureIndex, timeSignature));
  };

  // Gate all UX until the drum samples are warm in the HTTP cache so the first
  // Play/preview gesture decodes from cache instead of stalling on the network.
  // Covers the hash-restore path (isSetup starts true) too.
  if (!assetsReady) {
    return <LoadingScreen progress={assetsProgress} />;
  }

  if (!isSetup) {
    return (
      <>
        <IconSprite />
        <Help isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} showKeyboardCheatsheet={showKeyboardCheatsheet} />
        <Setup
          onSelect={handlePreview}
          onConfirm={handleConfirm}
          selectedSig={previewSig}
          onShowHelp={() => setIsHelpOpen(true)}
          kits={KITS}
          activeKit={activeKit}
          switchingKit={switchingKit}
          kitProgress={kitProgress}
          onSelectKit={handleSelectKit}
          className="min-h-full"
        />
      </>
    );
  }

  return (
    <div className="bg-surface-1 h-screen flex flex-col text-fg overflow-hidden w-fit max-w-screen min-w-[360px]">
      <IconSprite />
      {/* Screen-reader announcement of transport state (visually hidden). */}
      <div className="sr-only" role="status" aria-live="polite">{isPlaying ? 'Playing' : 'Paused'}</div>
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="@container flex-none flex items-center justify-between px-2 py-1 md:px-6 md:py-3">
          <div className="flex items-center gap-4">
            <h1 className="text-md md:text-xl font-black tracking-tighter text-fg uppercase flex items-center gap-2 select-none">
              <Icon id="logo" className="w-6 h-6 md:w-7 md:h-7 text-primary md:mt-0.5" />
              Quick Beats
            </h1>
          </div>

          <div className="relative" ref={menuRef}>
            {/* Hamburger trigger — hidden when container is wide enough */}
            <button
              onClick={() => setMenuOpen(o => !o)}
              className="text-fg-muted hover:text-fg transition-colors border border-border-default p-1.5 @min-[500px]:hidden"
              title="Menu"
            >
              <Icon id="menu" className="w-4 h-4" />
            </button>

            {/* Action buttons */}
            <div className={`
              ${menuOpen ? 'flex' : 'hidden'} flex-col absolute right-0 top-full mt-1 z-[90] bg-surface-2 border border-border-default shadow-2xl min-w-[160px]
              @min-[500px]:flex @min-[500px]:static @min-[500px]:flex-row @min-[500px]:items-center @min-[500px]:gap-2
              @min-[500px]:bg-transparent @min-[500px]:border-0 @min-[500px]:shadow-none @min-[500px]:min-w-0
            `}>
              <button
                onClick={() => { toggleTheme(); setMenuOpen(false); }}
                className="w-full text-left text-[10px] font-mono text-fg-muted hover:text-fg hover:bg-surface-4 px-4 py-2.5 uppercase tracking-tighter flex items-center gap-2 transition-colors @min-[500px]:w-auto @min-[500px]:hover:bg-transparent @min-[500px]:border @min-[500px]:border-border-default @min-[500px]:px-2 @min-[500px]:py-1"
                title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
              >
                <Icon id={theme === 'dark' ? 'sun' : 'moon'} className="w-3.5 h-3.5 @min-[500px]:w-3 @min-[500px]:h-3" />
                <span className="@min-[500px]:hidden">{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
              </button>
              <button
                onClick={() => { setIsShareOpen(true); setMenuOpen(false); }}
                className="w-full text-left text-[10px] font-bold font-mono text-fg-muted hover:text-fg hover:bg-surface-4 px-4 py-2.5 uppercase tracking-tighter flex items-center gap-2 transition-colors @min-[500px]:w-auto @min-[500px]:hover:bg-transparent @min-[500px]:border @min-[500px]:border-border-default @min-[500px]:px-2 @min-[500px]:py-1"
                title="Share Pattern"
              >
                <Icon id="share" className="w-3.5 h-3.5 @min-[500px]:w-3 @min-[500px]:h-3" /> Share Beat
              </button>
              <button
                onClick={() => { setIsHelpOpen(true); setMenuOpen(false); }}
                className="w-full text-left text-[10px] font-bold font-mono text-fg-muted hover:text-fg hover:bg-surface-4 px-4 py-2.5 uppercase tracking-tighter flex items-center gap-2 transition-colors @min-[500px]:w-auto @min-[500px]:hover:bg-transparent @min-[500px]:border @min-[500px]:border-border-default @min-[500px]:px-2 @min-[500px]:py-1"
                title="Help"
              >
                <Icon id="help" className="w-3.5 h-3.5 @min-[500px]:w-3 @min-[500px]:h-3" /> Help
              </button>
              <button
                onClick={() => { handleReset(); setMenuOpen(false); }}
                className="w-full text-left text-[10px] font-mono text-fg-muted hover:text-fg hover:bg-surface-4 px-4 py-2.5 uppercase tracking-tighter flex items-center gap-2 transition-colors border-t border-border-dim @min-[500px]:w-auto @min-[500px]:hover:bg-transparent @min-[500px]:border @min-[500px]:border-border-default @min-[500px]:px-2 @min-[500px]:py-1"
                title="Go Back to Setup"
              >
                Home
              </button>
            </div>
          </div>
        </header>

        <Help
          isOpen={isHelpOpen}
          onClose={() => setIsHelpOpen(false)}
          showKeyboardCheatsheet={showKeyboardCheatsheet}
        />

        <ShareModal
          isOpen={isShareOpen}
          onClose={() => setIsShareOpen(false)}
          shareUrl={window.location.href}
        />

        <div className="px-4 pt-2 md:px-6 bg-surface-6 border border-border-dim">
          <Controls
            isPlaying={isPlaying}
            togglePlay={togglePlay}
            bpm={bpmInput}
            setBpm={setBpmInput}
            autoScroll={autoScroll}
            setAutoScroll={setAutoScroll}
            canScroll={canScroll}
            zoom={zoom}
            setZoom={setZoom}
            humanizeStatus={humanizeStatus}
            humanizeProgress={modelProgress}
            onHumanize={humanizeAction}
            kits={KITS}
            activeKit={activeKit}
            switchingKit={switchingKit}
            kitProgress={kitProgress}
            onSelectKit={handleSelectKit}
          />
        </div>

        <Sequencer
          isPlaying={isPlaying}
          togglePlay={togglePlay}
          grid={grid}
          humanizedMask={humanizeActive ? humanizedLayer : null}
          toggleStep={toggleStep}
          bulkUpdateStep={bulkUpdateStep}
          currentStep={currentStep}
          stepCount={grid[0].length}
          setStep={setStep}
          addMeasure={addMeasure}
          removeMeasure={removeMeasure}
          beatsPerMeasure={timeSignature.beats}
          stepsPerBeat={timeSignature.stepsPerBeat}
          grouping={timeSignature.grouping}
          autoScroll={autoScroll}
          setAutoScroll={setAutoScroll}
          setCanScroll={setCanScroll}
          zoom={zoom}
        />

      </div>
    </div>
  )
}

export default App
