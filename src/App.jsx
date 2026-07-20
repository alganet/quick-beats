// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { useState, useEffect, useRef, useCallback } from 'react'
import { useTheme } from './hooks/useTheme'
import { useAudio } from './hooks/useAudio'
import { useHumanize } from './hooks/useHumanize'
import { useSamplePreload } from './hooks/useSamplePreload'
import { useHistoryState } from './hooks/useHistoryState'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useHumanizeLifecycle } from './hooks/useHumanizeLifecycle'
import { useLandscapeLock } from './hooks/useLandscapeLock'
import { useMediaQuery } from './hooks/useMediaQuery'
import { usePortraitNudge } from './hooks/usePortraitNudge'
import Sequencer from './components/Sequencer'
import Controls from './components/Controls'
import Setup from './components/Setup'
import LoadingScreen from './components/LoadingScreen'
import PortraitNudge from './components/PortraitNudge'
import ShareModal from './components/ShareModal'
import Help from './components/Help'
import { IconSprite, Icon } from './components/Icons'
import { normalizeZoom } from './data/sequencerConfig'
import { INSTRUMENTS, KITS, DEFAULT_KIT_ID } from './data/kit'
import { BACKBEATS } from './data/patterns'
import { COMMON_SIGNATURES } from './data/signatures'
import { parseInitialHash, buildShareHash } from './utils/hashState';
import { parseRoute } from './utils/routeState';
import {
  calculateBulkUpdate,
  calculateGridWithRemovedMeasure,
  calculateNewMeasure,
  generateGridFromSig,
  toggleGridStep
} from './utils/gridHelpers'

const ACTION_DELAY_MS = 200;

// One shape for every header action, so the row stays optically even whether a
// button carries an icon, a label, or both — mixing per-button padding is what
// makes their heights and centres disagree. h-6 is also the WCAG 2.5.8 minimum
// target size, which per-button padding alone did not reach.
const HEADER_ACTION_CLASS =
  'h-6 px-2 flex-none flex items-center gap-2 border border-border-default ' +
  'text-[11px] font-bold font-mono uppercase tracking-wide ' +
  'text-fg-muted hover:text-fg transition-colors';

function App() {
  const [theme, , toggleTheme] = useTheme();

  // Owned here rather than inside each consumer so the header button and the
  // portrait nudge share one set of media/fullscreen listeners and can't disagree.
  const rotate = useLandscapeLock();
  const portraitNudge = usePortraitNudge();

  // Split the loaded hash into its overlay and beat parts, then decode the beat
  // exactly as before. A legacy beat-only link parses identically — parseRoute
  // returns { overlay:'none', beat:<the whole legacy string> }.
  const _initialRoute = typeof window !== 'undefined'
    ? parseRoute(window.location.hash)
    : { overlay: 'none', beat: null };
  const _initialHash = _initialRoute.beat
    ? parseInitialHash(_initialRoute.beat, INSTRUMENTS.length, COMMON_SIGNATURES)
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
  // Seed the modals from a deep link (#help / #help~beat / #share~beat).
  const [isShareOpen, setIsShareOpen] = useState(_initialRoute.overlay === 'share');
  const [isHelpOpen, setIsHelpOpen] = useState(_initialRoute.overlay === 'help');
  const [timeSignature, setTimeSignature] = useState(_initialHash?.sig ?? null);
  const [previewSig, setPreviewSig] = useState(_initialHash?.sig ?? null);
  const [bpmInput, setBpmInput] = useState(_initialHash?.bpm ?? 120);
  const [grid, setGrid] = useState(_initialHash?.grid ?? []);
  // Default off under prefers-reduced-motion: the playhead auto-scroll is a
  // recurring half-viewport jump, and the toggle to disable it only renders
  // during playback — too late for someone the motion harms. A saved choice
  // still wins either way.
  const [autoScroll, setAutoScroll] = useState(() => {
    const saved = localStorage.getItem('qb-auto-scroll');
    if (saved !== null) return JSON.parse(saved);
    return !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  });
  // Same "chosen" split as zoom below: only a deliberate toggle is persisted.
  // Writing the seeded default back would freeze it, and someone who never
  // touched the toggle should keep following their OS motion preference.
  const [autoScrollChosen, setAutoScrollChosen] = useState(() => localStorage.getItem('qb-auto-scroll') !== null);
  const chooseAutoScroll = useCallback((updater) => {
    setAutoScrollChosen(true);
    setAutoScroll(updater);
  }, []);
  const [canScroll, setCanScroll] = useState(false);
  // qb-zoom means "the user picked this", not merely "this is the current zoom".
  // Until they do, the sequencer fits the zoom to the height it has; the moment
  // they do, that is the last word and nothing measures over it again.
  const [zoom, setZoom] = useState(() => normalizeZoom(localStorage.getItem('qb-zoom')));
  const [zoomChosen, setZoomChosen] = useState(() => localStorage.getItem('qb-zoom') !== null);

  const chooseZoom = useCallback((updater) => {
    setZoomChosen(true);
    setZoom(updater);
  }, []);


  // Persist UI preferences
  useEffect(() => {
    if (autoScrollChosen) localStorage.setItem('qb-auto-scroll', JSON.stringify(autoScroll));
  }, [autoScroll, autoScrollChosen]);

  // Only a deliberate choice is worth remembering. Persisting an auto-fitted
  // zoom would make the next visit read it back as a preference and stop
  // fitting — the feature would work exactly once.
  useEffect(() => {
    if (zoomChosen) localStorage.setItem('qb-zoom', zoom.toString());
  }, [zoom, zoomChosen]);

  // Remember the chosen kit so it's restored on the next visit.
  useEffect(() => {
    localStorage.setItem('qb-kit', activeKit);
  }, [activeKit]);

  // Global keyboard shortcuts — the cheatsheet only helps where there's a keyboard.
  const showKeyboardCheatsheet = useMediaQuery('(pointer: fine)');

  // WCAG 2.1.4: single-character shortcuts must be disableable — speech-input
  // software turns ordinary dictation into a stream of them.
  const [singleKeyShortcuts, setSingleKeyShortcuts] = useState(() => {
    const saved = localStorage.getItem('qb-single-key-shortcuts');
    return saved !== null ? JSON.parse(saved) : true;
  });
  useEffect(() => {
    localStorage.setItem('qb-single-key-shortcuts', JSON.stringify(singleKeyShortcuts));
  }, [singleKeyShortcuts]);

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

  // Which named overlay is open, if any — the modals are mutually exclusive, so
  // one slot captures the whole set. Mirrored into a ref so the imperative close
  // path can read it without re-subscribing listeners on every open/close.
  const overlay = isShareOpen ? 'share' : isHelpOpen ? 'help' : 'none';
  const overlayRef = useRef(overlay);
  useEffect(() => { overlayRef.current = overlay; });

  // Adopt a beat that arrives in the URL after load — an installed PWA gets a
  // tapped share link as a fragment change on the running document, not as a
  // fresh page load, so the hash has to be applied to live state here rather
  // than seeding it at mount. An unparseable hash with no overlay is left alone:
  // whatever is on screen is worth more than a link we can't read.
  const handleExternalHash = useCallback((hash) => {
    const route = parseRoute(hash);
    const shared = route.beat
      ? parseInitialHash(route.beat, INSTRUMENTS.length, COMMON_SIGNATURES)
      : null;
    if (!shared && route.overlay === 'none') return;

    if (shared) {
      setBpmInput(shared.bpm);
      setTimeSignature(shared.sig);
      setPreviewSig(shared.sig);
      setGrid(shared.grid);
      // The incoming grid can be a different length than the one playing, so the
      // playhead has to come back to a step that certainly exists.
      setStep(0);
      setIsSetup(true);
      handleSelectKit(shared.kitId);
    }
    // Apply the overlay the link named (opening or closing to match it).
    setIsHelpOpen(route.overlay === 'help');
    setIsShareOpen(route.overlay === 'share');
  }, [setStep, handleSelectKit]);

  // Back / Forward is the single authoritative place an overlay closes: it reads
  // the target history entry's stamp and sets the flags to match. Close buttons
  // and Escape route through history.back() so they can't double-close.
  const onPopOverlay = useCallback((name) => {
    setIsHelpOpen(name === 'help');
    setIsShareOpen(name === 'share');
  }, []);

  // Keep the URL hash in sync with the live pattern (debounced) and own the
  // overlay history entries (push on open, pop on close/back).
  const { openOverlay } = useHistoryState({
    isSetup, timeSignature, grid, bpmInput, activeKit,
    overlay,
    onPopOverlay,
    onExternalHash: handleExternalHash,
  });

  // Open a modal: flip its flag (instant render) and push a back-poppable entry.
  // No-ops while any overlay is up: the dialogs only swallow Escape and Tab, so
  // a `?` pressed inside an open Help would otherwise reach the global shortcut
  // and push a duplicate history entry per press — Back would then need that
  // many presses to close. (Before history entries, re-opening was idempotent.)
  const openHelp = useCallback(() => {
    if (overlayRef.current !== 'none') return;
    setIsHelpOpen(true);
    openOverlay('help');
  }, [openOverlay]);
  const openShare = useCallback(() => {
    if (overlayRef.current !== 'none') return;
    setIsShareOpen(true);
    openOverlay('share');
  }, [openOverlay]);
  // Close the top overlay via history so Back, the X button, and Escape share
  // one path. A no-op when nothing is open (a stray Escape must not leave the app).
  const closeOverlay = useCallback(() => {
    if (overlayRef.current !== 'none') window.history.back();
  }, []);

  useKeyboardShortcuts({
    togglePlay,
    setBpmInput,
    setZoom: chooseZoom,
    setAutoScroll: chooseAutoScroll,
    openHelp,
    onCloseOverlay: closeOverlay,
    humanizeAction,
    singleKeyEnabled: singleKeyShortcuts,
  });

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
        <Help
          isOpen={isHelpOpen}
          onClose={closeOverlay}
          showKeyboardCheatsheet={showKeyboardCheatsheet}
          singleKeyShortcuts={singleKeyShortcuts}
          onToggleSingleKeyShortcuts={() => setSingleKeyShortcuts((v) => !v)}
        />
        <Setup
          onSelect={handlePreview}
          onConfirm={handleConfirm}
          selectedSig={previewSig}
          onShowHelp={openHelp}
          kits={KITS}
          activeKit={activeKit}
          switchingKit={switchingKit}
          kitProgress={kitProgress}
          onSelectKit={handleSelectKit}
        />
      </>
    );
  }

  return (
    <div className="bg-surface-1 h-dvh safe-inset flex flex-col text-fg overflow-hidden w-fit max-w-screen">
      <IconSprite />
      {/* Screen-reader announcement of transport state (visually hidden). */}
      <div className="sr-only" role="status" aria-live="polite">{isPlaying ? 'Playing' : 'Paused'}</div>
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* short-landscape claws back vertical space where it is scarcest: a
            sideways phone spends 28% of its height on chrome. It is emitted after
            md:, so it wins those conflicts. Padding and the logo only — the action
            buttons are already at the 24px minimum target size. */}
        <header className="@container flex-none flex items-center justify-between px-2 py-1 md:px-6 md:py-3 short-landscape:py-1">
          <div className="flex items-center gap-4 min-w-0">
            <h1 className="md:text-xl font-black tracking-tighter text-fg uppercase flex items-center gap-2 select-none min-w-0">
              <Icon id="logo" className="w-6 h-6 md:w-7 md:h-7 short-landscape:w-6 short-landscape:h-6 text-primary md:mt-0.5 flex-none" />
              {/* The wordmark yields to the action row when the header is tight;
                  the logo alone still identifies the app. Dropping it is what
                  buys the space for the action row to stay expanded on a phone,
                  rather than collapsing to a hamburger. */}
              <span className="hidden @min-[600px]:inline truncate">Quick Beats</span>
            </h1>
          </div>

          <div className="flex items-center gap-2">
              {/* Absent on iOS and desktop, which cannot go fullscreen from a
                  touch context at all. A peer of the actions beside it rather
                  than a special case, so it inherits their metrics for free.

                  The icon tracks only the fullscreen state, never `canRotate`:
                  fullscreen is what this always does, whereas rotation is a bonus
                  we cannot confirm until lock() has been tried, and letting a
                  refusal restyle the glyph would mutate the control under the
                  user's finger. The label carries the difference instead. Stays
                  mounted while fullscreen regardless, so there is always a way
                  back out. */}
              {(rotate.available || rotate.isFullscreen) && (
                <button
                  onClick={rotate.isFullscreen ? rotate.exit : rotate.enter}
                  className={HEADER_ACTION_CLASS}
                  title={rotate.isFullscreen ? 'Exit fullscreen' : rotate.canRotate ? 'Fullscreen & landscape' : 'Fullscreen'}
                  aria-label={rotate.isFullscreen ? 'Exit fullscreen' : rotate.canRotate ? 'Fullscreen & landscape' : 'Fullscreen'}
                >
                  <Icon id={rotate.isFullscreen ? 'fullscreen-exit' : 'fullscreen'} className="w-3 h-3" />
                </button>
              )}
              <button
                onClick={toggleTheme}
                className={HEADER_ACTION_CLASS}
                title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
                aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
              >
                <Icon id={theme === 'dark' ? 'sun' : 'moon'} className="w-3 h-3" />
              </button>
              <button
                onClick={openShare}
                className={HEADER_ACTION_CLASS}
                title="Share Pattern"
              >
                <Icon id="share" className="w-3 h-3" /> Share Beat
              </button>
              <button
                onClick={openHelp}
                className={HEADER_ACTION_CLASS}
                title="Help"
              >
                <Icon id="help" className="w-3 h-3" /> Help
              </button>
              <button
                onClick={handleReset}
                className={HEADER_ACTION_CLASS}
                title="Go Back to Setup"
              >
                Home
              </button>
          </div>
        </header>

        <Help
          isOpen={isHelpOpen}
          onClose={closeOverlay}
          showKeyboardCheatsheet={showKeyboardCheatsheet}
          singleKeyShortcuts={singleKeyShortcuts}
          onToggleSingleKeyShortcuts={() => setSingleKeyShortcuts((v) => !v)}
        />

        <ShareModal
          isOpen={isShareOpen}
          onClose={closeOverlay}
          // The live URL carries `share~` while this modal is open, so a copied
          // link would reopen Share. Share the clean, overlay-free beat link.
          shareUrl={isShareOpen
            ? window.location.origin + window.location.pathname + '#'
              + buildShareHash({ bpm: bpmInput, sigName: timeSignature.name, kitId: activeKit, grid })
            : ''}
        />

        <div className="px-4 pt-2 md:px-6 short-landscape:pt-1 bg-surface-6 border border-border-dim">
          <Controls
            isPlaying={isPlaying}
            togglePlay={togglePlay}
            bpm={bpmInput}
            setBpm={setBpmInput}
            autoScroll={autoScroll}
            setAutoScroll={chooseAutoScroll}
            canScroll={canScroll}
            zoom={zoom}
            setZoom={chooseZoom}
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
          setAutoScroll={chooseAutoScroll}
          setCanScroll={setCanScroll}
          fitZoomToHeight={!zoomChosen}
          onFitZoom={setZoom}
          zoom={zoom}
        />

      </div>

      {portraitNudge.visible && (
        <PortraitNudge
          canRotate={rotate.canRotate}
          onRotate={rotate.enter}
          onDismiss={portraitNudge.dismiss}
        />
      )}
    </div>
  )
}

export default App
