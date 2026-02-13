// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import App from './App';

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
};

vi.mock('./hooks/useAudio', () => ({
    useAudio: () => mockUseAudio,
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
    default: ({ isPlaying, togglePlay, setBpm }) => (
        <div data-testid="mock-controls">
            <button onClick={togglePlay}>{isPlaying ? 'Stop' : 'Play'}</button>
            <input data-testid="bpm-input" onChange={(e) => setBpm(parseInt(e.target.value))} />
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
});
