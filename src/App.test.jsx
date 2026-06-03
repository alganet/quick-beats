// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
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
};

vi.mock('./hooks/useHumanize', () => ({
    useHumanize: () => mockUseHumanize,
}));

// Mock child components to verify props and interactions
vi.mock('./components/Sequencer', () => ({
    default: ({ toggleStep, addMeasure, removeMeasure, bulkUpdateStep, stepCount, setCanScroll: _ }) => {
        return (
        <div data-testid="mock-sequencer">
            <button data-testid="toggle-step-btn" onClick={() => toggleStep(0, 1)}>Toggle Step</button>
            <button data-testid="add-measure-btn" onClick={addMeasure}>Add Measure</button>
            <button data-testid="remove-measure-btn" onClick={() => removeMeasure(0)}>Remove Measure</button>
            <button data-testid="bulk-update-btn" onClick={() => bulkUpdateStep(0, 0, 'repeat')}>Bulk Update</button>
            <span data-testid="step-count">{stepCount}</span>
        </div>
    )}
}));

vi.mock('./components/Controls', () => ({
    default: ({ isPlaying, togglePlay, setBpm, humanizeStatus, onHumanize }) => (
        <div data-testid="mock-controls">
            <button onClick={togglePlay}>{isPlaying ? 'Stop' : 'Play'}</button>
            <input data-testid="bpm-input" onChange={(e) => setBpm(parseInt(e.target.value))} />
            <button data-testid="humanize-btn" data-status={humanizeStatus} onClick={onHumanize}>Humanize</button>
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
    default: ({ isOpen, onClose }) => isOpen ? <div data-testid="mock-share-modal"><button onClick={onClose}>Close</button></div> : null
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

    it('opens and closes modals', () => {
        mockUseAudio.isLoaded = true;
        render(<App />);
        
         // Enter main screen
        fireEvent.click(screen.getByText('Select 4/4'));
        fireEvent.click(screen.getByText('Start'));
        
        // Share Modal
        const shareBtn = screen.getByTitle('Share Pattern');
        fireEvent.click(shareBtn);
        expect(screen.getByTestId('mock-share-modal')).toBeInTheDocument();
        fireEvent.click(screen.getByText('Close'));
        expect(screen.queryByTestId('mock-share-modal')).not.toBeInTheDocument();
         
        // Help Modal
        const helpBtn = screen.getByTitle('Help');
        fireEvent.click(helpBtn);
        expect(screen.getByTestId('mock-help')).toBeInTheDocument();
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

    it('saves preferences to localStorage', () => {
         mockUseAudio.isLoaded = true;
         render(<App />);
         expect(localStorageMock.setItem).toHaveBeenCalledWith('qb-auto-scroll', 'true');
         expect(localStorageMock.setItem).toHaveBeenCalledWith('qb-zoom', '1');
    });

    it('closes modals when pressing Escape', () => {
        mockUseAudio.isLoaded = true;
        render(<App />);
        fireEvent.click(screen.getByText('Select 4/4'));
        fireEvent.click(screen.getByText('Start'));

        const shareBtn = screen.getByTitle('Share Pattern');
        fireEvent.click(shareBtn);
        expect(screen.getByTestId('mock-share-modal')).toBeInTheDocument();

        fireEvent.keyDown(window, { key: 'Escape' });
        expect(screen.queryByTestId('mock-share-modal')).not.toBeInTheDocument();
    });

    it('closes help modal when pressing Escape', () => {
        mockUseAudio.isLoaded = true;
        render(<App />);
        fireEvent.click(screen.getByText('Select 4/4'));
        fireEvent.click(screen.getByText('Start'));

        const helpBtn = screen.getByTitle('Help');
        fireEvent.click(helpBtn);
        expect(screen.getByTestId('mock-help')).toBeInTheDocument();

        fireEvent.keyDown(window, { key: 'Escape' });
        expect(screen.queryByTestId('mock-help')).not.toBeInTheDocument();
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

    it('opens and closes hamburger menu', () => {
        mockUseAudio.isLoaded = true;
        render(<App />);
        fireEvent.click(screen.getByText('Select 4/4'));
        fireEvent.click(screen.getByText('Start'));

        const menuBtn = screen.getByTitle('Menu');

        // Menu starts closed — action buttons are in the DOM but hidden via CSS
        // (container query controls visibility, but in jsdom they're always rendered)

        // Open menu
        fireEvent.click(menuBtn);
        // Buttons should still be accessible
        expect(screen.getByTitle('Share Pattern')).toBeInTheDocument();
        expect(screen.getByTitle('Help')).toBeInTheDocument();
        expect(screen.getByTitle('Go Back to Setup')).toBeInTheDocument();

        // Close menu by clicking outside
        fireEvent.mouseDown(document.body);
        // Menu button still present
        expect(screen.getByTitle('Menu')).toBeInTheDocument();
    });

    it('closes menu when an action is selected', () => {
        mockUseAudio.isLoaded = true;
        render(<App />);
        fireEvent.click(screen.getByText('Select 4/4'));
        fireEvent.click(screen.getByText('Start'));

        // Open menu and click Help — should open help and close menu
        fireEvent.click(screen.getByTitle('Menu'));
        fireEvent.click(screen.getByTitle('Help'));
        expect(screen.getByTestId('mock-help')).toBeInTheDocument();
    });

    it('theme toggle works from within the menu', () => {
        mockUseAudio.isLoaded = true;
        render(<App />);
        fireEvent.click(screen.getByText('Select 4/4'));
        fireEvent.click(screen.getByText('Start'));

        // Open menu, toggle theme
        fireEvent.click(screen.getByTitle('Menu'));
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
