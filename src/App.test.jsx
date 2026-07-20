// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import App from './App';
import { encodeGrid } from './utils/hashState';
import { INSTRUMENTS } from './data/kit';
import { COMMON_SIGNATURES } from './data/signatures';

// Mocks
const mockUseAudio = {
    isLoaded: false,
    isPlaying: false,
    currentStep: 0,
    activeKit: 'black-pearl',
    loadKit: vi.fn(),
    togglePlay: vi.fn(),
    setBpm: vi.fn(),
    updateGrid: vi.fn(),
    setStep: vi.fn(),
    playNote: vi.fn(),
    setPerfLayer: vi.fn(),
    setHumanizeEnabled: vi.fn(),
    setHumanizeOptions: vi.fn(),
};

vi.mock('./hooks/useAudio', () => ({
    useAudio: () => mockUseAudio,
}));

const mockUseHumanize = {
    phase: 'idle',
    compute: vi.fn().mockResolvedValue(null),
    reset: vi.fn(),
    warmup: vi.fn(),
    modelPhase: 'ready',
    modelProgress: 1,
    computeBackend: 'js', // default to the slow path so the 5s idle tests hold
};

vi.mock('./hooks/useHumanize', () => ({
    useHumanize: () => mockUseHumanize,
}));

// Samples are pre-warmed in tests so the app renders past the loading gate.
const mockUseSamplePreload = { ready: true, progress: 1 };
vi.mock('./hooks/useSamplePreload', () => ({
    useSamplePreload: () => mockUseSamplePreload,
}));

// Mock child components to verify props and interactions
vi.mock('./components/Sequencer', () => ({
    default: ({ toggleStep, addMeasure, removeMeasure, bulkUpdateStep, stepCount, humanizedMask, setCanScroll: _ }) => {
        return (
        <div data-testid="mock-sequencer" data-humanized={humanizedMask ? 'yes' : 'no'}>
            <button data-testid="toggle-step-btn" onClick={() => toggleStep(0, 1)}>Toggle Step</button>
            <button data-testid="add-measure-btn" onClick={addMeasure}>Add Measure</button>
            <button data-testid="remove-measure-btn" onClick={() => removeMeasure(0)}>Remove Measure</button>
            <button data-testid="bulk-update-btn" onClick={() => bulkUpdateStep(0, 0, 'repeat')}>Bulk Update</button>
            <span data-testid="step-count">{stepCount}</span>
        </div>
    )}
}));

vi.mock('./components/Controls', () => ({
    default: ({ isPlaying, togglePlay, setBpm, humanizeStatus, onHumanize, onSelectKit }) => (
        <div data-testid="mock-controls">
            <button onClick={togglePlay}>{isPlaying ? 'Stop' : 'Play'}</button>
            <input data-testid="bpm-input" onChange={(e) => setBpm(parseInt(e.target.value))} />
            <button data-testid="humanize-btn" data-status={humanizeStatus} onClick={onHumanize}>Humanize</button>
            <button data-testid="select-kit-btn" onClick={() => onSelectKit('red-zeppelin')}>Switch Kit</button>
        </div>
    )
}));

vi.mock('./components/Setup', () => ({
    default: ({ onSelect, onConfirm }) => (
        <div data-testid="mock-setup">
            <button onClick={() => onSelect({ name: '4/4', beats: 4, stepsPerBeat: 4, grouping: 4 })}>Select 4/4</button>
            <button onClick={onConfirm}>Start</button>
        </div>
    )
}));

vi.mock('./components/ShareModal', () => ({
    default: ({ isOpen, onClose, shareUrl }) => isOpen ? <div data-testid="mock-share-modal" data-share-url={shareUrl}><button onClick={onClose}>Close</button></div> : null
}));

vi.mock('./components/Help', () => ({
    default: ({ isOpen, onClose, showKeyboardCheatsheet }) => isOpen ? <div data-testid="mock-help" data-show-cheatsheet={String(showKeyboardCheatsheet)}><button onClick={onClose}>Close</button></div> : null
}));

vi.mock('./components/Icons', () => ({
    IconSprite: () => <div data-testid="icon-sprite" />,
    Icon: ({ id }) => <span data-testid={`icon-${id}`} />
}));

// Mock for localStorage
const localStorageMock = (() => {
    let store = {};
    return {
        getItem: vi.fn((key) => store[key] || null),
        setItem: vi.fn((key, value) => { store[key] = value.toString(); }),
        clear: vi.fn(() => { store = {}; })
    };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('App', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorageMock.clear();
        mockUseAudio.isLoaded = false;
        mockUseAudio.isPlaying = false;
        mockUseAudio.updateGrid.mockClear();
        mockUseAudio.playNote.mockClear();
        mockUseHumanize.phase = 'idle';
        mockUseHumanize.compute.mockResolvedValue(null);
        mockUseHumanize.reset.mockClear();
        mockUseHumanize.warmup.mockClear();
        mockUseHumanize.modelPhase = 'ready';
        mockUseHumanize.modelProgress = 1;
        mockUseHumanize.computeBackend = 'js';
        mockUseSamplePreload.ready = true;
        mockUseSamplePreload.progress = 1;
        window.location.hash = '';
    });

    it('renders setup screen immediately even if audio is not loaded', () => {
        render(<App />);
        expect(screen.getByTestId('mock-setup')).toBeInTheDocument();
    });

    it('renders setup screen when loaded', () => {
        mockUseAudio.isLoaded = true;
        render(<App />);
        expect(screen.getByTestId('mock-setup')).toBeInTheDocument();
    });

    it('reads valid URL hash on initial render and shows main sequencer (no setup flash)', () => {
        // Build an empty grid matching the number of instruments for 4/4 (16 steps)
        const rows = INSTRUMENTS.length;
        const steps = 16;
        const grid = Array.from({ length: rows }, () => Array.from({ length: steps }, () => false));
        const encoded = encodeGrid(grid);

        window.location.hash = `#120|4/4|black-pearl|${encoded}|v1`;

        render(<App />);

        // Setup should NOT be shown and Sequencer should mount with the decoded grid
        expect(screen.queryByTestId('mock-setup')).not.toBeInTheDocument();
        expect(screen.getByTestId('mock-sequencer')).toBeInTheDocument();
        expect(mockUseAudio.updateGrid).toHaveBeenCalledWith(grid);
    });

    it('opens a beat whose hash arrives after load, from the setup screen', () => {
        // An installed PWA is never re-loaded by a tapped share link: the running
        // document just gets a new fragment. Cold-load parsing alone leaves the
        // user staring at the setup screen with the shared beat dropped.
        render(<App />);
        expect(screen.getByTestId('mock-setup')).toBeInTheDocument();

        const grid = Array.from({ length: INSTRUMENTS.length }, () => Array.from({ length: 16 }, () => false));
        grid[0][4] = true;

        act(() => {
            window.location.hash = `#132|4/4|black-pearl|${encodeGrid(grid)}|v1`;
            window.dispatchEvent(new Event('hashchange'));
        });

        expect(screen.queryByTestId('mock-setup')).not.toBeInTheDocument();
        expect(screen.getByTestId('mock-sequencer')).toBeInTheDocument();
        expect(mockUseAudio.updateGrid).toHaveBeenCalledWith(grid);
    });

    it('replaces the beat already on screen when a shared hash arrives', () => {
        renderWith44();

        const grid = Array.from({ length: INSTRUMENTS.length }, () => Array.from({ length: 12 }, () => false));
        grid[1][2] = true;

        act(() => {
            window.location.hash = `#90|3/4|black-pearl|${encodeGrid(grid)}|v1`;
            window.dispatchEvent(new Event('hashchange'));
        });

        expect(mockUseAudio.updateGrid).toHaveBeenCalledWith(grid);
        // The incoming grid is shorter than the one playing, so the playhead has
        // to be brought back to a step that still exists.
        expect(mockUseAudio.setStep).toHaveBeenCalledWith(0);
    });

    it('keeps the current beat when the hash changes to something unreadable', () => {
        renderWith44();
        mockUseAudio.updateGrid.mockClear();

        act(() => {
            window.location.hash = '#not-a-beat';
            window.dispatchEvent(new Event('hashchange'));
        });

        expect(screen.getByTestId('mock-sequencer')).toBeInTheDocument();
        expect(mockUseAudio.updateGrid).not.toHaveBeenCalled();
    });

    const renderWith44 = () => {
        const grid = Array.from({ length: INSTRUMENTS.length }, () => Array.from({ length: 16 }, () => false));
        window.location.hash = `#120|4/4|black-pearl|${encodeGrid(grid)}|v1`;
        return render(<App />);
    };

    it('toggling Humanize on (off, 16th-note sig) computes and goes "on"', async () => {
        mockUseHumanize.compute.mockResolvedValue([[{ vel: 0.5, offsetSec: 0 }]]);
        renderWith44();
        const btn = screen.getByTestId('humanize-btn');
        expect(btn).toHaveAttribute('data-status', 'off');

        await act(async () => { fireEvent.click(btn); });
        expect(mockUseHumanize.compute).toHaveBeenCalledTimes(1);
        expect(mockUseAudio.setPerfLayer).toHaveBeenCalled();
        expect(mockUseAudio.setHumanizeEnabled).toHaveBeenCalledWith(true);
        expect(screen.getByTestId('humanize-btn')).toHaveAttribute('data-status', 'on');
    });

    it('applies streamed partial layers as they arrive (progressive humanize)', async () => {
        const partial = [[{ vel: 0.4, offsetSec: 0 }]];
        const finalLayer = [[{ vel: 0.5, offsetSec: 0 }]];
        mockUseHumanize.compute.mockImplementation((g, bpm, onPartial) => {
            onPartial?.(partial); // stream one window before resolving
            return Promise.resolve(finalLayer);
        });
        renderWith44();
        await act(async () => { fireEvent.click(screen.getByTestId('humanize-btn')); });
        expect(mockUseAudio.setPerfLayer).toHaveBeenCalledWith(partial); // partial applied
        expect(mockUseAudio.setPerfLayer).toHaveBeenCalledWith(finalLayer); // then final
    });

    it('editing the grid while "on" shows "pending"; clicking turns off (engine disabled)', async () => {
        mockUseHumanize.compute.mockResolvedValue([[{ vel: 0.5, offsetSec: 0 }]]);
        renderWith44();

        await act(async () => { fireEvent.click(screen.getByTestId('humanize-btn')); });
        expect(screen.getByTestId('humanize-btn')).toHaveAttribute('data-status', 'on');

        // edit -> pending (auto re-humanize is queued, not run yet)
        mockUseHumanize.compute.mockClear();
        await act(async () => { fireEvent.click(screen.getByTestId('toggle-step-btn')); });
        expect(screen.getByTestId('humanize-btn')).toHaveAttribute('data-status', 'pending');
        expect(mockUseHumanize.compute).not.toHaveBeenCalled();

        // clicking turns it off without computing; the engine is disabled
        mockUseAudio.setHumanizeEnabled.mockClear();
        await act(async () => { fireEvent.click(screen.getByTestId('humanize-btn')); });
        expect(mockUseHumanize.compute).not.toHaveBeenCalled();
        expect(mockUseAudio.setHumanizeEnabled).toHaveBeenCalledWith(false);
        expect(screen.getByTestId('humanize-btn')).toHaveAttribute('data-status', 'off');
    });

    it('auto re-humanizes after the grid is idle while on', async () => {
        vi.useFakeTimers();
        try {
            mockUseHumanize.compute.mockResolvedValue([[{ vel: 0.5, offsetSec: 0 }]]);
            renderWith44();

            await act(async () => { fireEvent.click(screen.getByTestId('humanize-btn')); });
            expect(screen.getByTestId('humanize-btn')).toHaveAttribute('data-status', 'on');

            mockUseHumanize.compute.mockClear();
            await act(async () => { fireEvent.click(screen.getByTestId('toggle-step-btn')); });
            expect(screen.getByTestId('humanize-btn')).toHaveAttribute('data-status', 'pending');

            // before idle elapses: still no recompute
            await act(async () => { await vi.advanceTimersByTimeAsync(4000); });
            expect(mockUseHumanize.compute).not.toHaveBeenCalled();

            // idle window passes -> one recompute -> back to "on"
            await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
            expect(mockUseHumanize.compute).toHaveBeenCalledTimes(1);
            expect(screen.getByTestId('humanize-btn')).toHaveAttribute('data-status', 'on');
        } finally {
            vi.useRealTimers();
        }
    });

    it('re-humanizes after a shorter idle (~1.2s) when the WASM backend is active', async () => {
        vi.useFakeTimers();
        try {
            mockUseHumanize.computeBackend = 'wasm';
            mockUseHumanize.compute.mockResolvedValue([[{ vel: 0.5, offsetSec: 0 }]]);
            renderWith44();

            await act(async () => { fireEvent.click(screen.getByTestId('humanize-btn')); });
            mockUseHumanize.compute.mockClear();
            await act(async () => { fireEvent.click(screen.getByTestId('toggle-step-btn')); });
            expect(screen.getByTestId('humanize-btn')).toHaveAttribute('data-status', 'pending');

            // below the WASM idle: no recompute yet
            await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
            expect(mockUseHumanize.compute).not.toHaveBeenCalled();

            // past ~1.2s: one recompute (well before the 5s JS debounce)
            await act(async () => { await vi.advanceTimersByTimeAsync(300); });
            expect(mockUseHumanize.compute).toHaveBeenCalledTimes(1);
        } finally {
            vi.useRealTimers();
        }
    });

    it('passes a humanized mask to the Sequencer once a layer streams in (and clears it off)', async () => {
        mockUseHumanize.compute.mockImplementation((g, bpm, onPartial) => {
            onPartial?.([[{ vel: 0.5, offsetSec: 0 }]]);
            return Promise.resolve([[{ vel: 0.5, offsetSec: 0 }]]);
        });
        renderWith44();
        expect(screen.getByTestId('mock-sequencer')).toHaveAttribute('data-humanized', 'no');

        await act(async () => { fireEvent.click(screen.getByTestId('humanize-btn')); }); // on
        expect(screen.getByTestId('mock-sequencer')).toHaveAttribute('data-humanized', 'yes');

        await act(async () => { fireEvent.click(screen.getByTestId('humanize-btn')); }); // off
        expect(screen.getByTestId('mock-sequencer')).toHaveAttribute('data-humanized', 'no');
    });

    it('shows the spinner while a background re-humanize is computing (layer already applied)', async () => {
        // First run resolves so a layer is applied (humanizedGrid is set).
        mockUseHumanize.compute.mockResolvedValueOnce([[{ vel: 0.5, offsetSec: 0 }]]);
        renderWith44();
        await act(async () => { fireEvent.click(screen.getByTestId('humanize-btn')); });
        expect(screen.getByTestId('humanize-btn')).toHaveAttribute('data-status', 'on');

        // The worker is now mid-compute on a background re-humanize. An in-flight
        // compute must show the spinner even though a layer is already playing.
        mockUseHumanize.phase = 'computing';
        await act(async () => { fireEvent.click(screen.getByTestId('toggle-step-btn')); });
        expect(screen.getByTestId('humanize-btn')).toHaveAttribute('data-status', 'computing');
    });

    it('toggling off then on reuses the remembered layer (no recompute)', async () => {
        mockUseHumanize.compute.mockResolvedValue([[{ vel: 0.5, offsetSec: 0 }]]);
        renderWith44();

        await act(async () => { fireEvent.click(screen.getByTestId('humanize-btn')); }); // on (compute #1)
        await act(async () => { fireEvent.click(screen.getByTestId('humanize-btn')); }); // off

        mockUseHumanize.compute.mockClear();
        mockUseAudio.setHumanizeEnabled.mockClear();
        await act(async () => { fireEvent.click(screen.getByTestId('humanize-btn')); }); // on again, unchanged grid
        expect(mockUseHumanize.compute).not.toHaveBeenCalled();
        expect(mockUseAudio.setHumanizeEnabled).toHaveBeenCalledWith(true);
        expect(screen.getByTestId('humanize-btn')).toHaveAttribute('data-status', 'on');
    });

    it('resets humanization when the time signature changes (Home)', async () => {
        mockUseHumanize.compute.mockResolvedValue([[{ vel: 0.5, offsetSec: 0 }]]);
        renderWith44();
        await act(async () => { fireEvent.click(screen.getByTestId('humanize-btn')); });
        expect(screen.getByTestId('humanize-btn')).toHaveAttribute('data-status', 'on');

        mockUseAudio.setPerfLayer.mockClear();
        // Home -> timeSignature becomes null, which discards the humanization.
        await act(async () => { fireEvent.click(screen.getAllByTitle('Go Back to Setup')[0]); });
        expect(mockUseHumanize.reset).toHaveBeenCalled();
        expect(mockUseAudio.setPerfLayer).toHaveBeenCalledWith(null);
        expect(mockUseAudio.setHumanizeEnabled).toHaveBeenCalledWith(false);
    });

    it('rescales humanized microtiming (no recompute) when bpm changes while on', async () => {
        mockUseHumanize.compute.mockResolvedValue([[{ vel: 0.5, offsetSec: 0.02 }]]);
        renderWith44();
        await act(async () => { fireEvent.click(screen.getByTestId('humanize-btn')); });

        mockUseHumanize.compute.mockClear();
        mockUseAudio.setPerfLayer.mockClear();
        // 120 -> 60 doubles the 16th-note length, so offsets scale by oldBpm/newBpm = 2.
        await act(async () => {
            fireEvent.change(screen.getByTestId('bpm-input'), { target: { value: '60' } });
        });
        expect(mockUseHumanize.compute).not.toHaveBeenCalled(); // rescale, not a model run
        const rescaled = mockUseAudio.setPerfLayer.mock.calls.at(-1)[0];
        expect(rescaled[0][0].offsetSec).toBeCloseTo(0.04, 6);
    });

    it('shows "unavailable" and does not compute for a non-16th-note signature (6/8)', () => {
        const sig = COMMON_SIGNATURES.find((s) => s.name === '6/8');
        const steps = sig.beats * sig.stepsPerBeat;
        const grid = Array.from({ length: INSTRUMENTS.length }, () => Array.from({ length: steps }, () => false));
        window.location.hash = `#120|6/8|black-pearl|${encodeGrid(grid)}|v1`;
        render(<App />);

        expect(screen.getByTestId('humanize-btn')).toHaveAttribute('data-status', 'unavailable');
        fireEvent.keyDown(window, { key: 'h' });
        expect(mockUseHumanize.compute).not.toHaveBeenCalled();
    });

    it('warms up the model on entering the sequencer for a supported signature', () => {
        renderWith44();
        expect(mockUseHumanize.warmup).toHaveBeenCalled();
    });

    it('does not warm up the model until the drum samples are ready', () => {
        mockUseSamplePreload.ready = false;
        mockUseSamplePreload.progress = 0.3;
        renderWith44();
        // The loading screen gates the UX and the 8MB model waits its turn.
        // (The announcer's empty status region also mounts here, hence getAll.)
        const statuses = screen.getAllByRole('status');
        expect(statuses.some((el) => /loading sounds/i.test(el.getAttribute('aria-label') ?? ''))).toBe(true);
        expect(screen.queryByTestId('mock-sequencer')).not.toBeInTheDocument();
        expect(mockUseHumanize.warmup).not.toHaveBeenCalled();
    });

    it('does not warm up the model for an unsupported signature', () => {
        const sig = COMMON_SIGNATURES.find((s) => s.name === '6/8');
        const steps = sig.beats * sig.stepsPerBeat;
        const grid = Array.from({ length: INSTRUMENTS.length }, () => Array.from({ length: steps }, () => false));
        window.location.hash = `#120|6/8|black-pearl|${encodeGrid(grid)}|v1`;
        render(<App />);
        expect(mockUseHumanize.warmup).not.toHaveBeenCalled();
    });

    it('shows "loading" and ignores clicks while the model is downloading', async () => {
        mockUseHumanize.modelPhase = 'loading';
        mockUseHumanize.modelProgress = 0.5;
        renderWith44();
        const btn = screen.getByTestId('humanize-btn');
        expect(btn).toHaveAttribute('data-status', 'loading');
        await act(async () => { fireEvent.click(btn); });
        expect(mockUseHumanize.compute).not.toHaveBeenCalled();
        expect(screen.getByTestId('humanize-btn')).toHaveAttribute('data-status', 'loading');
    });

    it('retries the model download from the error state on click', async () => {
        mockUseHumanize.modelPhase = 'error';
        renderWith44();
        const btn = screen.getByTestId('humanize-btn');
        expect(btn).toHaveAttribute('data-status', 'error');
        mockUseHumanize.warmup.mockClear();
        await act(async () => { fireEvent.click(btn); });
        expect(mockUseHumanize.warmup).toHaveBeenCalled();
        expect(mockUseHumanize.compute).not.toHaveBeenCalled();
    });

    it('"h" triggers the humanize action; ignored while typing in an input', async () => {
        mockUseHumanize.compute.mockResolvedValue([[{ vel: 0.5, offsetSec: 0 }]]);
        renderWith44();

        const input = document.createElement('input');
        document.body.appendChild(input);
        fireEvent.keyDown(input, { key: 'h' });
        expect(mockUseHumanize.compute).not.toHaveBeenCalled();
        input.remove();

        await act(async () => { fireEvent.keyDown(window, { key: 'h' }); });
        expect(mockUseHumanize.compute).toHaveBeenCalledTimes(1);
    });

    it('updates URL hash after loading from a shared URI when grid changes', () => {
        vi.useFakeTimers();

        // Arrange: start from a shared hash
        const rows = INSTRUMENTS.length;
        const steps = 16;
        const grid = Array.from({ length: rows }, () => Array.from({ length: steps }, () => false));
        const encoded = encodeGrid(grid);
        window.location.hash = `#120|4/4|black-pearl|${encoded}|v1`;

        render(<App />);

        // Sanity: sequencer mounted
        expect(screen.getByTestId('mock-sequencer')).toBeInTheDocument();

        // Act: toggle a step and advance timers past the hash-sync delay
        fireEvent.click(screen.getByTestId('toggle-step-btn'));
        vi.advanceTimersByTime(250);

        // Assert: URL fragment has been updated (grid portion changed)
        expect(window.location.hash).toMatch(/^#\d+\|4\/4\|black-pearl\|\d+\.[A-Za-z0-9\-_]+\|v1$/);

        vi.useRealTimers();
    });

    it('handles signature selection and preview', () => {
        mockUseAudio.isLoaded = true;
        render(<App />);
        
        // Select 4/4
        fireEvent.click(screen.getByText('Select 4/4'));
        
        // Should update grid and start playing
        expect(mockUseAudio.updateGrid).toHaveBeenCalled();
        expect(mockUseAudio.togglePlay).toHaveBeenCalled();
    });

    it('transitions to main sequencer on confirm', () => {
        mockUseAudio.isLoaded = true;
        render(<App />);
        
        // Select and Confirm
        fireEvent.click(screen.getByText('Select 4/4'));
        fireEvent.click(screen.getByText('Start'));
        
        expect(screen.getByTestId('mock-sequencer')).toBeInTheDocument();
        expect(screen.getByTestId('mock-controls')).toBeInTheDocument();
    });

    it('toggles playback from controls', () => {
        mockUseAudio.isLoaded = true;
        mockUseAudio.isPlaying = false;
        
        render(<App />);
        
        // Enter main screen
        fireEvent.click(screen.getByText('Select 4/4'));
        fireEvent.click(screen.getByText('Start'));
        
        const playBtn = screen.getByText('Play');
        fireEvent.click(playBtn);
        expect(mockUseAudio.togglePlay).toHaveBeenCalled();
    });

    it('supports keyboard shortcuts (space = play/pause)', () => {
        mockUseAudio.isLoaded = true;
        render(<App />);
        fireEvent.click(screen.getByText('Select 4/4'));
        fireEvent.click(screen.getByText('Start'));

        mockUseAudio.togglePlay.mockClear();
        fireEvent.keyDown(window, { key: ' ', code: 'Space' });
        expect(mockUseAudio.togglePlay).toHaveBeenCalled();
    });

    it('opens help when pressing ?', () => {
        mockUseAudio.isLoaded = true;
        render(<App />);
        fireEvent.click(screen.getByText('Select 4/4'));
        fireEvent.click(screen.getByText('Start'));

        fireEvent.keyDown(window, { key: '?' });
        expect(screen.getByTestId('mock-help')).toBeInTheDocument();
    });

    it('does not stack history entries when ? is pressed with Help already open', () => {
        // The dialog only swallows Escape/Tab, so a second ? reaches the global
        // shortcut; it must be a no-op, or every press would add a history entry
        // and Back/Escape would need that many presses to close.
        const pushStateSpy = vi.spyOn(window.history, 'pushState').mockImplementation(() => {});
        mockUseAudio.isLoaded = true;
        render(<App />);
        fireEvent.click(screen.getByText('Select 4/4'));
        fireEvent.click(screen.getByText('Start'));

        fireEvent.keyDown(window, { key: '?' });
        expect(screen.getByTestId('mock-help')).toBeInTheDocument();
        expect(pushStateSpy).toHaveBeenCalledTimes(1);

        fireEvent.keyDown(window, { key: '?' });
        expect(screen.getByTestId('mock-help')).toBeInTheDocument();
        expect(pushStateSpy).toHaveBeenCalledTimes(1);
        pushStateSpy.mockRestore();
    });

    it('passes pointer precision to Help so cheatsheet only shows on fine pointers', () => {
        // Simulate fine pointer environment
        const origMatchMedia = window.matchMedia;
        window.matchMedia = vi.fn().mockImplementation(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));

        mockUseAudio.isLoaded = true;
        render(<App />);
        fireEvent.click(screen.getByText('Select 4/4'));
        fireEvent.click(screen.getByText('Start'));

        // open Help so mocked Help mounts
        const helpBtn = screen.getByTitle('Help');
        fireEvent.click(helpBtn);

        const help = screen.getByTestId('mock-help');
        expect(help.dataset.showCheatsheet).toBe('true');

        // restore
        window.matchMedia = origMatchMedia;
    });

    it('omits the rotate button where the platform cannot lock orientation', () => {
        // jsdom has no Fullscreen API, standing in for iOS and desktop — the two
        // places rotation is unavailable. The control must not appear at all
        // rather than appear and silently do nothing.
        mockUseAudio.isLoaded = true;
        render(<App />);
        fireEvent.click(screen.getByText('Select 4/4'));
        fireEvent.click(screen.getByText('Start'));

        expect(screen.queryByTitle('Rotate to landscape')).not.toBeInTheDocument();
        expect(screen.queryByTitle('Exit fullscreen')).not.toBeInTheDocument();
    });

    it('supports BPM keyboard shortcuts (- / =)', () => {
        vi.useFakeTimers();
        mockUseAudio.isLoaded = true;
        render(<App />);
        fireEvent.click(screen.getByText('Select 4/4'));
        fireEvent.click(screen.getByText('Start'));

        mockUseAudio.setBpm.mockClear();
        // Decrease
        fireEvent.keyDown(window, { key: '-' });
        expect(mockUseAudio.setBpm).not.toHaveBeenCalled();
        vi.advanceTimersByTime(210);
        expect(mockUseAudio.setBpm).toHaveBeenLastCalledWith(119);

        // Increase
        mockUseAudio.setBpm.mockClear();
        fireEvent.keyDown(window, { key: '=' });
        expect(mockUseAudio.setBpm).not.toHaveBeenCalled();
        vi.advanceTimersByTime(210);
        expect(mockUseAudio.setBpm).toHaveBeenLastCalledWith(120);

        vi.useRealTimers();
    });

    it('toggles zoom (z) and auto-scroll (s) via keyboard', () => {
        vi.useFakeTimers();
        mockUseAudio.isLoaded = true;
        render(<App />);
        fireEvent.click(screen.getByText('Select 4/4'));
        fireEvent.click(screen.getByText('Start'));

        // zoom persists to localStorage
        localStorageMock.setItem.mockClear();
        fireEvent.keyDown(window, { key: 'z' });
        act(() => {
            vi.advanceTimersByTime(210);
        });
        expect(localStorageMock.setItem).toHaveBeenCalledWith('qb-zoom', expect.any(String));

        // auto-scroll persists to localStorage
        localStorageMock.setItem.mockClear();
        fireEvent.keyDown(window, { key: 's' });
        act(() => {
            vi.advanceTimersByTime(210);
        });
        expect(localStorageMock.setItem).toHaveBeenCalledWith('qb-auto-scroll', expect.any(String));

        vi.useRealTimers();
    });

    it('ignores shortcuts when focused on input', () => {
        mockUseAudio.isLoaded = true;
        render(<App />);
        fireEvent.click(screen.getByText('Select 4/4'));
        fireEvent.click(screen.getByText('Start'));

        // Focus BPM input and ensure space / - are ignored
        const bpmInput = screen.getByTestId('bpm-input');
        bpmInput.focus();

        mockUseAudio.togglePlay.mockClear();
        mockUseAudio.setBpm.mockClear();

        fireEvent.keyDown(bpmInput, { key: ' ' });
        fireEvent.keyDown(bpmInput, { key: '-' });

        expect(mockUseAudio.togglePlay).not.toHaveBeenCalled();
        expect(mockUseAudio.setBpm).not.toHaveBeenCalled();
    });

    it('opens and closes modals', async () => {
        mockUseAudio.isLoaded = true;
        render(<App />);

         // Enter main screen
        fireEvent.click(screen.getByText('Select 4/4'));
        fireEvent.click(screen.getByText('Start'));

        // Share Modal — closing routes through history.back(), so the popstate
        // that actually closes it lands on a later tick.
        const shareBtn = screen.getByTitle('Share Pattern');
        fireEvent.click(shareBtn);
        expect(screen.getByTestId('mock-share-modal')).toBeInTheDocument();
        fireEvent.click(screen.getByText('Close'));
        await waitFor(() => expect(screen.queryByTestId('mock-share-modal')).not.toBeInTheDocument());

        // Help Modal
        const helpBtn = screen.getByTitle('Help');
        fireEvent.click(helpBtn);
        expect(screen.getByTestId('mock-help')).toBeInTheDocument();
    });

    it('closes an open modal on the browser Back button', async () => {
        mockUseAudio.isLoaded = true;
        render(<App />);
        fireEvent.click(screen.getByText('Select 4/4'));
        fireEvent.click(screen.getByText('Start'));

        fireEvent.click(screen.getByTitle('Help'));
        expect(screen.getByTestId('mock-help')).toBeInTheDocument();

        // The hardware/browser Back button pops the pushed overlay entry.
        act(() => { window.history.back(); });
        await waitFor(() => expect(screen.queryByTestId('mock-help')).not.toBeInTheDocument());
    });

    it('deep-links straight into the Help modal (#help~beat)', () => {
        const grid = Array.from({ length: INSTRUMENTS.length }, () => Array.from({ length: 16 }, () => false));
        window.location.hash = `#help~120|4/4|black-pearl|${encodeGrid(grid)}|v1`;

        render(<App />);

        // Beat present → Sequencer, and the overlay marker opens Help.
        expect(screen.getByTestId('mock-sequencer')).toBeInTheDocument();
        expect(screen.getByTestId('mock-help')).toBeInTheDocument();
    });

    it('adopts the beat and opens Help from an external overlay link', () => {
        render(<App />);
        expect(screen.getByTestId('mock-setup')).toBeInTheDocument();

        const grid = Array.from({ length: INSTRUMENTS.length }, () => Array.from({ length: 16 }, () => false));
        grid[0][4] = true;

        act(() => {
            window.location.hash = `#help~132|4/4|black-pearl|${encodeGrid(grid)}|v1`;
            window.dispatchEvent(new Event('hashchange'));
        });

        expect(screen.getByTestId('mock-sequencer')).toBeInTheDocument();
        expect(mockUseAudio.updateGrid).toHaveBeenCalledWith(grid);
        expect(screen.getByTestId('mock-help')).toBeInTheDocument();
    });

    it('shares the clean beat link, without the overlay marker', () => {
        mockUseAudio.isLoaded = true;
        render(<App />);
        fireEvent.click(screen.getByText('Select 4/4'));
        fireEvent.click(screen.getByText('Start'));

        fireEvent.click(screen.getByTitle('Share Pattern'));
        const url = screen.getByTestId('mock-share-modal').getAttribute('data-share-url');
        // The live URL carries `share~` while the modal is open; the copied link
        // must not, or loading it would reopen Share.
        expect(url).not.toContain('share~');
        expect(url).toMatch(/#\d+\|4\/4\|black-pearl\|/);
    });
    
    it('handles reset (Home button)', () => {
        mockUseAudio.isLoaded = true;
        render(<App />);
        
         // Enter main screen
        fireEvent.click(screen.getByText('Select 4/4'));
        fireEvent.click(screen.getByText('Start'));
        
        // Click Home
        const homeBtn = screen.getByTitle('Go Back to Setup');
        fireEvent.click(homeBtn);
        
        expect(screen.getByTestId('mock-setup')).toBeInTheDocument();
        expect(screen.queryByTestId('mock-sequencer')).not.toBeInTheDocument();
    });

    it('adds and removes measures', () => {
        mockUseAudio.isLoaded = true;
        render(<App />);
        
        // Enter main screen
        fireEvent.click(screen.getByText('Select 4/4'));
        fireEvent.click(screen.getByText('Start'));
        
        // Initial steps: 4/4 * 4 steps/beat = 16 steps
        const countSpan = screen.getByTestId('step-count');
        expect(countSpan).toHaveTextContent('16');
        
        // Add Measure
        fireEvent.click(screen.getByTestId('add-measure-btn'));
        expect(countSpan).toHaveTextContent('32'); // 16 + 16
        
        // Remove Measure
        fireEvent.click(screen.getByTestId('remove-measure-btn'));
        expect(countSpan).toHaveTextContent('16');
    });

    it('announces measure add and remove to screen readers', () => {
        mockUseAudio.isLoaded = true;
        render(<App />);
        fireEvent.click(screen.getByText('Select 4/4'));
        fireEvent.click(screen.getByText('Start'));

        // 4/4 starts at one measure (16 steps); adding takes it to two.
        fireEvent.click(screen.getByTestId('add-measure-btn'));
        expect(screen.getByText('Measure added, 2 total')).toBeInTheDocument();

        fireEvent.click(screen.getByTestId('remove-measure-btn'));
        expect(screen.getByText('Measure 1 removed')).toBeInTheDocument();
    });

    it('announces a kit switch: loading then ready', async () => {
        mockUseAudio.isLoaded = true;
        mockUseAudio.loadKit.mockResolvedValueOnce('ok');
        render(<App />);
        fireEvent.click(screen.getByText('Select 4/4'));
        fireEvent.click(screen.getByText('Start'));

        fireEvent.click(screen.getByTestId('select-kit-btn'));
        expect(screen.getByText('Loading Red Zeppelin…')).toBeInTheDocument();
        expect(await screen.findByText('Red Zeppelin ready')).toBeInTheDocument();
    });

    it('announces a kit-load failure assertively', async () => {
        // loadKit never rejects — the gapless contract keeps the old kit
        // playing on a sample failure — so failure arrives as a resolved
        // outcome, not an exception.
        mockUseAudio.isLoaded = true;
        mockUseAudio.loadKit.mockResolvedValueOnce('failed');
        render(<App />);
        fireEvent.click(screen.getByText('Select 4/4'));
        fireEvent.click(screen.getByText('Start'));

        fireEvent.click(screen.getByTestId('select-kit-btn'));
        const alert = await screen.findByText('Could not load Red Zeppelin');
        expect(alert.closest('[role="alert"]')).toBeInTheDocument();
    });

    it('does not claim a superseded kit switch is ready', async () => {
        // Click kit A, then quickly kit B: A resolves 'superseded' and must
        // stay silent — only B's own announcements should be heard.
        mockUseAudio.isLoaded = true;
        mockUseAudio.loadKit.mockResolvedValueOnce('superseded');
        render(<App />);
        fireEvent.click(screen.getByText('Select 4/4'));
        fireEvent.click(screen.getByText('Start'));

        fireEvent.click(screen.getByTestId('select-kit-btn'));
        expect(screen.getByText('Loading Red Zeppelin…')).toBeInTheDocument();
        await act(async () => {});
        expect(screen.queryByText('Red Zeppelin ready')).not.toBeInTheDocument();
        expect(screen.queryByText('Could not load Red Zeppelin')).not.toBeInTheDocument();
    });

    it('announces humanize turning on and off', async () => {
        mockUseAudio.isLoaded = true;
        // Resolve a real layer so the run finishes and the status reaches 'on'.
        mockUseHumanize.compute.mockResolvedValueOnce({ mock: true });
        render(<App />);
        fireEvent.click(screen.getByText('Select 4/4'));
        fireEvent.click(screen.getByText('Start'));

        // Toggling humanize is otherwise only signalled by the button lighting.
        fireEvent.click(screen.getByTestId('humanize-btn'));
        expect(await screen.findByText('Humanized')).toBeInTheDocument();

        fireEvent.click(screen.getByTestId('humanize-btn'));
        expect(screen.getByText('Humanize removed')).toBeInTheDocument();
    });

    it('toggles steps via Sequencer cb', () => {
        mockUseAudio.isLoaded = true;
        render(<App />);

        fireEvent.click(screen.getByText('Select 4/4'));
        fireEvent.click(screen.getByText('Start'));

        fireEvent.click(screen.getByTestId('toggle-step-btn'));

        // Should play note and update grid
        expect(mockUseAudio.playNote).toHaveBeenCalled();
        expect(mockUseAudio.updateGrid).toHaveBeenCalled();
    });

    it('updates URL hash when grid changes', () => {
        vi.useFakeTimers();
        mockUseAudio.isLoaded = true;
        render(<App />);

        // Enter main screen
        fireEvent.click(screen.getByText('Select 4/4'));
        fireEvent.click(screen.getByText('Start'));

        // Toggle a step and advance timers past the hash-sync delay
        fireEvent.click(screen.getByTestId('toggle-step-btn'));
        vi.advanceTimersByTime(250);

        // hash includes encoded grid + version suffix
        // Expect kit segment + grid columns + encoded data + version
        expect(window.location.hash).toMatch(/^#\d+\|4\/4\|black-pearl\|\d+\.[A-Za-z0-9\-_]+\|v1$/);
        vi.useRealTimers();
    });

    it('bulk updates steps via Sequencer cb', () => {
        mockUseAudio.isLoaded = true;
        render(<App />);
        
        fireEvent.click(screen.getByText('Select 4/4'));
        fireEvent.click(screen.getByText('Start'));
        
        fireEvent.click(screen.getByTestId('bulk-update-btn'));
        expect(mockUseAudio.playNote).toHaveBeenCalled();
    });

    it('saves an auto-scroll choice, but never the untouched default', () => {
        // Writing the seeded default back on mount would freeze it as a "saved
        // choice" and stop the OS motion preference from ever mattering again.
        vi.useFakeTimers();
        mockUseAudio.isLoaded = true;
        render(<App />);
        expect(localStorageMock.setItem).not.toHaveBeenCalledWith('qb-auto-scroll', expect.any(String));

        fireEvent.keyDown(window, { key: 's' });
        act(() => {
            vi.advanceTimersByTime(210);
        });
        expect(localStorageMock.setItem).toHaveBeenCalledWith('qb-auto-scroll', 'false');
        vi.useRealTimers();
    });

    it('defaults auto-scroll off under prefers-reduced-motion', () => {
        // The playhead auto-scroll is a recurring half-viewport jump and its
        // toggle only renders during playback — the default has to respect the
        // OS preference because the user can't get ahead of it.
        const origMatchMedia = window.matchMedia;
        window.matchMedia = vi.fn((query) => ({
            matches: query === '(prefers-reduced-motion: reduce)',
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
        }));

        vi.useFakeTimers();
        mockUseAudio.isLoaded = true;
        render(<App />);
        // The default is not persisted (see above); toggling from it records
        // 'true', proving the reduced-motion default really started off.
        expect(localStorageMock.setItem).not.toHaveBeenCalledWith('qb-auto-scroll', expect.any(String));

        fireEvent.keyDown(window, { key: 's' });
        act(() => {
            vi.advanceTimersByTime(210);
        });
        expect(localStorageMock.setItem).toHaveBeenCalledWith('qb-auto-scroll', 'true');
        vi.useRealTimers();

        window.matchMedia = origMatchMedia;
    });

    it('lets a saved auto-scroll choice win over prefers-reduced-motion', () => {
        localStorageMock.setItem('qb-auto-scroll', 'true');
        localStorageMock.setItem.mockClear();
        const origMatchMedia = window.matchMedia;
        window.matchMedia = vi.fn(() => ({
            matches: true,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
        }));

        mockUseAudio.isLoaded = true;
        render(<App />);
        expect(localStorageMock.setItem).toHaveBeenCalledWith('qb-auto-scroll', 'true');

        window.matchMedia = origMatchMedia;
    });

    it('does not record a zoom preference the user never expressed', () => {
        // qb-zoom is the user's choice, not the current zoom. Writing it on mount
        // would make the next visit read it back as a preference and stop fitting
        // the grid to the viewport — auto-fit would work exactly once.
        mockUseAudio.isLoaded = true;
        render(<App />);
        fireEvent.click(screen.getByText('Select 4/4'));
        fireEvent.click(screen.getByText('Start'));

        expect(localStorageMock.setItem).not.toHaveBeenCalledWith('qb-zoom', expect.anything());
    });

    it('records the zoom once the user changes it', () => {
        vi.useFakeTimers();
        mockUseAudio.isLoaded = true;
        render(<App />);
        fireEvent.click(screen.getByText('Select 4/4'));
        fireEvent.click(screen.getByText('Start'));

        // The z shortcut is debounced.
        fireEvent.keyDown(window, { key: 'z' });
        act(() => { vi.advanceTimersByTime(210); });

        expect(localStorageMock.setItem).toHaveBeenCalledWith('qb-zoom', '2');
        vi.useRealTimers();
    });

    it('heals a stored zoom this build cannot render', () => {
        // Components index ZOOM_CONFIG raw, so a level we never wrote — a stale
        // one from a build with more zooms, or a hand-edited key — used to reach
        // them as undefined and blank the app, with no way back short of
        // clearing site data. Persisting '1' is what proves the bad value was
        // normalized on the way in rather than carried into state.
        localStorageMock.setItem('qb-zoom', '99');
        localStorageMock.setItem.mockClear();
        mockUseAudio.isLoaded = true;

        render(<App />);
        fireEvent.click(screen.getByText('Select 4/4'));
        fireEvent.click(screen.getByText('Start'));

        expect(screen.getByTestId('mock-sequencer')).toBeInTheDocument();
        expect(localStorageMock.setItem).toHaveBeenCalledWith('qb-zoom', '1');
    });

    it('closes modals when pressing Escape', async () => {
        mockUseAudio.isLoaded = true;
        render(<App />);
        fireEvent.click(screen.getByText('Select 4/4'));
        fireEvent.click(screen.getByText('Start'));

        const shareBtn = screen.getByTitle('Share Pattern');
        fireEvent.click(shareBtn);
        expect(screen.getByTestId('mock-share-modal')).toBeInTheDocument();

        fireEvent.keyDown(window, { key: 'Escape' });
        await waitFor(() => expect(screen.queryByTestId('mock-share-modal')).not.toBeInTheDocument());
    });

    it('closes help modal when pressing Escape', async () => {
        mockUseAudio.isLoaded = true;
        render(<App />);
        fireEvent.click(screen.getByText('Select 4/4'));
        fireEvent.click(screen.getByText('Start'));

        const helpBtn = screen.getByTitle('Help');
        fireEvent.click(helpBtn);
        expect(screen.getByTestId('mock-help')).toBeInTheDocument();

        fireEvent.keyDown(window, { key: 'Escape' });
        await waitFor(() => expect(screen.queryByTestId('mock-help')).not.toBeInTheDocument());
    });

    it('handles reset while playing', () => {
        mockUseAudio.isLoaded = true;
        mockUseAudio.isPlaying = true;
        render(<App />);
        fireEvent.click(screen.getByText('Select 4/4'));
        fireEvent.click(screen.getByText('Start'));

        mockUseAudio.togglePlay.mockClear();
        const homeBtn = screen.getByTitle('Go Back to Setup');
        fireEvent.click(homeBtn);

        expect(mockUseAudio.togglePlay).toHaveBeenCalled();
    });

    it('handles invalid URL hash gracefully', () => {
        window.location.hash = '#invalid-hash';
        render(<App />);
        expect(screen.getByTestId('mock-setup')).toBeInTheDocument();
    });

    it('handles URL hash with invalid grid data gracefully', () => {
        window.location.hash = '#120|4/4|black-pearl|invalidgrid|v1';
        render(<App />);
        expect(screen.getByTestId('mock-setup')).toBeInTheDocument();
    });

    it('handles URL hash with invalid signature gracefully', () => {
        const rows = INSTRUMENTS.length;
        const steps = 16;
        const grid = Array.from({ length: rows }, () => Array.from({ length: steps }, () => false));
        const encoded = encodeGrid(grid);
        window.location.hash = `#120|INVALID_SIG|black-pearl|${encoded}|v1`;
        render(<App />);
        expect(screen.getByTestId('mock-setup')).toBeInTheDocument();
    });

    it('handles URL hash with too few parts gracefully', () => {
        window.location.hash = '#120|4/4';
        render(<App />);
        expect(screen.getByTestId('mock-setup')).toBeInTheDocument();
    });

    it('handles empty hash gracefully', () => {
        window.location.hash = '';
        mockUseAudio.isLoaded = true;
        render(<App />);
        expect(screen.getByTestId('mock-setup')).toBeInTheDocument();
    });

    it('toggles theme between dark and light', () => {
        mockUseAudio.isLoaded = true;
        render(<App />);
        fireEvent.click(screen.getByText('Select 4/4'));
        fireEvent.click(screen.getByText('Start'));

        // Default is dark — theme button shows sun icon
        const themeBtn = screen.getByTitle('Switch to light theme');
        expect(screen.getByTestId('icon-sun')).toBeInTheDocument();
        expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

        // Click to switch to light
        fireEvent.click(themeBtn);
        expect(document.documentElement.getAttribute('data-theme')).toBe('light');
        expect(screen.getByTestId('icon-moon')).toBeInTheDocument();
        expect(screen.getByTitle('Switch to dark theme')).toBeInTheDocument();

        // Click to switch back to dark
        fireEvent.click(screen.getByTitle('Switch to dark theme'));
        expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
        expect(screen.getByTestId('icon-sun')).toBeInTheDocument();
    });

    it('exposes every header action directly, with no menu to open first', () => {
        // The wordmark collapses instead of the actions, so the row always fits
        // and there is no hamburger to unfold.
        mockUseAudio.isLoaded = true;
        render(<App />);
        fireEvent.click(screen.getByText('Select 4/4'));
        fireEvent.click(screen.getByText('Start'));

        expect(screen.queryByTitle('Menu')).not.toBeInTheDocument();
        expect(screen.getByTitle('Share Pattern')).toBeInTheDocument();
        expect(screen.getByTitle('Help')).toBeInTheDocument();
        expect(screen.getByTitle('Go Back to Setup')).toBeInTheDocument();
    });

    it('opens help straight from the header', () => {
        mockUseAudio.isLoaded = true;
        render(<App />);
        fireEvent.click(screen.getByText('Select 4/4'));
        fireEvent.click(screen.getByText('Start'));

        fireEvent.click(screen.getByTitle('Help'));
        expect(screen.getByTestId('mock-help')).toBeInTheDocument();
    });

    it('toggles theme straight from the header', () => {
        mockUseAudio.isLoaded = true;
        render(<App />);
        fireEvent.click(screen.getByText('Select 4/4'));
        fireEvent.click(screen.getByText('Start'));

        fireEvent.click(screen.getByTitle('Switch to light theme'));
        expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    });

    it('loads shared URL with kit selection', () => {
        const rows = INSTRUMENTS.length;
        const steps = 16;
        const grid = Array.from({ length: rows }, () => Array.from({ length: steps }, () => false));
        const encoded = encodeGrid(grid);
        window.location.hash = `#120|4/4|custom-kit|${encoded}|v1`;
        render(<App />);
        expect(screen.queryByTestId('mock-setup')).not.toBeInTheDocument();
    });
});
