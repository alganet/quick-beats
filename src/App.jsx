// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { useState, useEffect, useRef } from 'react'
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
import { encodeGrid, decodeGrid } from './utils/hashState'

function App() {
  const { isLoaded, isPlaying, currentStep, activeKit, loadKit, togglePlay, setBpm, updateGrid, setStep } = useAudio();
  const isInternalUpdate = useRef(false);

  const [isSetup, setIsSetup] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [timeSignature, setTimeSignature] = useState(null);
  const [previewSig, setPreviewSig] = useState(null);
  const [bpmInput, setBpmInput] = useState(120);
  const [grid, setGrid] = useState([]);

  // Handle ESC key for modals
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsShareOpen(false);
        setIsHelpOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Load state from Hash initially
  useEffect(() => {
    const hash = window.location.hash.substring(1);
    if (hash) {
      try {
        const parts = hash.split('|');
        if (parts.length >= 4) {
          const loadedBpm = parseInt(parts[0]);
          const sigName = parts[1];
          let kitId = "black-pearl";
          let gridData = "";

          if (parts.length === 4) {
            gridData = parts[2];
          } else {
            kitId = parts[2];
            gridData = parts[3];
          }

          const sig = COMMON_SIGNATURES.find(s => s.name === sigName);
          if (sig) {
            const decodedGrid = decodeGrid(gridData, INSTRUMENTS.length);
            if (decodedGrid) {
              isInternalUpdate.current = true;
              setTimeSignature(sig);
              setBpmInput(loadedBpm);
              setGrid(decodedGrid);
              setIsSetup(true);
              if (kitId !== "black-pearl") loadKit(kitId);
              return;
            }
          }
        }
      } catch (e) {
        console.error("Failed to parse hash state", e);
      }
    }
  }, [loadKit]);

  // Update hash when state changes
  useEffect(() => {
    if (isSetup && timeSignature && grid.length > 0) {
      if (isInternalUpdate.current) {
        isInternalUpdate.current = false;
        return;
      }
      const gridHash = encodeGrid(grid);
      const hash = `${bpmInput}|${timeSignature.name}|${activeKit}|${gridHash}|v1`;
      window.history.replaceState(null, '', `#${hash}`);
    }
  }, [grid, bpmInput, timeSignature, isSetup, activeKit]);

  // Sync BPM on change
  useEffect(() => {
    setBpm(bpmInput);
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
    const stepsPerMeasure = sig.beats * sig.stepsPerBeat;

    // Set default tempo for the pattern
    if (patternData?.tempo) {
      setBpmInput(patternData.tempo);
    }

    const newGrid = INSTRUMENTS.map((inst) => {
      const row = Array(stepsPerMeasure).fill(false);
      const instrumentPattern = patternData?.rhythm?.[inst] || [];
      instrumentPattern.forEach(step => {
        if (step < stepsPerMeasure) row[step] = true;
      });
      return row;
    });
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
    const newGrid = grid.map((r, rIdx) => {
      if (rIdx === row) {
        return r.map((c, cIdx) => (cIdx === col ? !c : c));
      }
      return r;
    });
    setGrid(newGrid);
  };

  const addMeasure = () => {
    const stepsPerMeasure = timeSignature.beats * timeSignature.stepsPerBeat;
    const newGrid = grid.map(row => [...row, ...Array(stepsPerMeasure).fill(false)]);
    setGrid(newGrid);
  };

  const clearGrid = () => {
    const currentSteps = grid[0].length;
    setGrid(INSTRUMENTS.map(() => Array(currentSteps).fill(false)));
  };

  if (!isLoaded) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-900 text-cyan-400 animate-pulse">
        LOADING DRUM KIT...
      </div>
    );
  }

  if (!isSetup) {
    return (
      <>
        <Help isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
        <Setup
          onSelect={handlePreview}
          onConfirm={handleConfirm}
          selectedSig={previewSig}
          onShowHelp={() => setIsHelpOpen(true)}
        />
      </>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[#0a0a0a] text-white overflow-hidden">
      <IconSprite />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex-none my-2 mx-4 md:mx-6 flex items-center justify-between border-b border-[#1e1e1e] pb-2">
          <div className="flex items-center gap-4">
            <button
              onClick={handleReset}
              className="text-[10px] font-mono text-slate-500 hover:text-white transition-colors border border-[#333] px-2 py-1 uppercase tracking-tighter"
              title="Exit to Setup"
            >
              Back
            </button>
            <h1 className="text-xl md:text-2xl font-black tracking-tighter text-white uppercase">
              Quick Beats
            </h1>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            <button
              onClick={() => setIsShareOpen(true)}
              className="p-1.5 md:p-2 text-slate-500 hover:text-[#3b82f6] transition-colors"
              title="Share Pattern"
            >
              <Icon id="share" className="w-3.5 h-3.5 md:w-4 md:h-4" />
            </button>
            <span className="px-2 py-0.5 border border-[#333] text-[9px] text-[#3b82f6] font-mono tracking-widest uppercase">
              {timeSignature.name}
            </span>
            <button
              onClick={() => setIsHelpOpen(true)}
              className="hidden md:block text-slate-600 hover:text-white transition-colors font-mono text-[10px] uppercase tracking-tighter"
              title="Project Info & Help"
            >
              v1.0.0
            </button>
          </div>
        </header>

        <Help
          isOpen={isHelpOpen}
          onClose={() => setIsHelpOpen(false)}
        />

        <ShareModal
          isOpen={isShareOpen}
          onClose={() => setIsShareOpen(false)}
          shareUrl={window.location.href}
        />

        <div className="px-4 md:px-6">
          <Controls
            isPlaying={isPlaying}
            togglePlay={togglePlay}
            bpm={bpmInput}
            setBpm={setBpmInput}
            addMeasure={addMeasure}
          />
        </div>

        <Sequencer
          grid={grid}
          toggleStep={toggleStep}
          currentStep={currentStep}
          stepCount={grid[0].length}
          setStep={setStep}
          addMeasure={addMeasure}
          beatsPerMeasure={timeSignature.beats}
          stepsPerBeat={timeSignature.stepsPerBeat}
          grouping={timeSignature.grouping}
        />

      </div>
    </div>
  )
}

export default App
