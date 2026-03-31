// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { useState, useEffect, useRef, useCallback } from 'react'
import { useTheme } from './hooks/useTheme'
import { useAudio } from './hooks/useAudio'
import Sequencer from './components/Sequencer'
import Controls from './components/Controls'
import Setup from './components/Setup'
import ShareModal from './components/ShareModal'
import Help from './components/Help'
import { IconSprite, Icon } from './components/Icons'
import { INSTRUMENTS } from './data/kit'
import { BACKBEATS } from './data/patterns'
import { COMMON_SIGNATURES } from './data/signatures'
import { parseShareHash, buildShareHash } from './utils/hashState';
import {
  calculateBulkUpdate,
  calculateGridWithRemovedMeasure,
  calculateNewMeasure,
  generateGridFromSig,
  toggleGridStep
} from './utils/gridHelpers'

const ACTION_DELAY_MS = 200;
const HASH_SYNC_DELAY_MS = 180;

function App() {
  const [theme, , toggleTheme] = useTheme();
  const { isPlaying, currentStep, activeKit, togglePlay, setBpm, updateGrid, setStep, playNote } = useAudio();
  const lastHashRef = useRef(typeof window !== 'undefined' && window.location.hash ? window.location.hash.substring(1) : '');
  const bpmApplyTimeoutRef = useRef(null);
  const hashSyncTimeoutRef = useRef(null);
  const keyboardZoomTimeoutRef = useRef(null);
  const keyboardAutoScrollTimeoutRef = useRef(null);

  const _parsedHash = typeof window !== 'undefined'
    ? parseShareHash(window.location.hash.substring(1), INSTRUMENTS.length)
    : null;

  const _initialHash = _parsedHash && COMMON_SIGNATURES.find(s => s.name === _parsedHash.sigName)
    ? { success: true, bpm: _parsedHash.bpm, sig: COMMON_SIGNATURES.find(s => s.name === _parsedHash.sigName), kitId: _parsedHash.kitId, grid: _parsedHash.grid }
    : null;

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

  useEffect(() => {
    return () => {
      if (keyboardZoomTimeoutRef.current) {
        clearTimeout(keyboardZoomTimeoutRef.current);
      }
      if (keyboardAutoScrollTimeoutRef.current) {
        clearTimeout(keyboardAutoScrollTimeoutRef.current);
      }
    };
  }, []);

  const scheduleKeyboardZoomToggle = useCallback(() => {
    if (keyboardZoomTimeoutRef.current) {
      clearTimeout(keyboardZoomTimeoutRef.current);
    }

    keyboardZoomTimeoutRef.current = setTimeout(() => {
      keyboardZoomTimeoutRef.current = null;
      setZoom((z) => (z + 1) % 3);
    }, ACTION_DELAY_MS);
  }, [setZoom]);

  const scheduleKeyboardAutoScrollToggle = useCallback(() => {
    if (keyboardAutoScrollTimeoutRef.current) {
      clearTimeout(keyboardAutoScrollTimeoutRef.current);
    }

    keyboardAutoScrollTimeoutRef.current = setTimeout(() => {
      keyboardAutoScrollTimeoutRef.current = null;
      setAutoScroll((a) => !a);
    }, ACTION_DELAY_MS);
  }, [setAutoScroll]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore when typing in form controls
      const tag = e.target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      // Space => play / pause
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        togglePlay?.();
        return;
      }

      // ? => show help
      if (e.key === '?') {
        setIsHelpOpen(true);
        return;
      }

      // - / = => BPM down / up (clamped to range used by UI)
      if (e.key === '-') {
        setBpmInput((prev) => Math.max(60, prev - 1));
        return;
      }
      if (e.key === '=') {
        setBpmInput((prev) => Math.min(240, prev + 1));
        return;
      }

      // z => toggle zoom
      if (typeof e.key === 'string' && e.key.toLowerCase() === 'z') {
        scheduleKeyboardZoomToggle();
        return;
      }

      // s => toggle auto-scroll
      if (typeof e.key === 'string' && e.key.toLowerCase() === 's') {
        scheduleKeyboardAutoScrollToggle();
        return;
      }

      // Preserve existing Escape behavior for modals
      if (e.key === 'Escape') {
        setIsShareOpen(false);
        setIsHelpOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, setBpmInput, scheduleKeyboardZoomToggle, scheduleKeyboardAutoScrollToggle]);

  // Update hash when state changes
  useEffect(() => {
    if (isSetup && timeSignature && grid.length > 0) {
      if (hashSyncTimeoutRef.current) {
        clearTimeout(hashSyncTimeoutRef.current);
      }

      hashSyncTimeoutRef.current = setTimeout(() => {
        const hash = buildShareHash({ bpm: bpmInput, sigName: timeSignature.name, kitId: activeKit, grid });
        if (hash !== lastHashRef.current) {
          window.history.replaceState(null, '', `#${hash}`);
          lastHashRef.current = hash;
        }
        hashSyncTimeoutRef.current = null;
      }, HASH_SYNC_DELAY_MS);
    }

    return () => {
      if (hashSyncTimeoutRef.current) {
        clearTimeout(hashSyncTimeoutRef.current);
      }
    };
  }, [grid, bpmInput, timeSignature, isSetup, activeKit]);

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
          className="min-h-full"
        />
      </>
    );
  }

  return (
    <div className="bg-surface-1 h-screen flex flex-col text-fg overflow-hidden w-fit max-w-screen min-w-[360px]">
      <IconSprite />
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
          />
        </div>

        <Sequencer
          isPlaying={isPlaying}
          togglePlay={togglePlay}
          grid={grid}
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
