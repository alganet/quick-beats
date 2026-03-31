// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import App from './App';
import { encodeGrid } from './utils/hashState';
import { INSTRUMENTS } from './data/kit';

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
