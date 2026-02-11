// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import App from './App';
import * as useAudioHook from './hooks/useAudio';

vi.mock('./hooks/useAudio', () => ({
    useAudio: vi.fn(),
}));

vi.mock('./components/Sequencer', () => {
    const MockSequencer = ({ setCanScroll }) => {
        // Force canScroll to true so Controls renders the auto-scroll toggle
        const { useEffect } = require('react');
        useEffect(() => {
            setCanScroll(true);
        }, [setCanScroll]);
        return <div data-testid="mock-sequencer" />;
    };
    return { default: MockSequencer };
});

// Mock for localStorage
const localStorageMock = (() => {
    let store = {};
    return {
        getItem: vi.fn((key) => store[key] || null),
        setItem: vi.fn((key, value) => {
            store[key] = value.toString();
        }),
        clear: vi.fn(() => {
            store = {};
        }),
        removeItem: vi.fn((key) => {
            delete store[key];
        }),
    };
})();

Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
});

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(function () {
    return {
        observe: vi.fn(),
        unobserve: vi.fn(),
        disconnect: vi.fn(),
    };
});

// Mock window.scrollTo and Element.scrollTo to avoid 'not implemented' error in JSDOM
window.scrollTo = vi.fn();
if (!Element.prototype.scrollTo) {
    Element.prototype.scrollTo = vi.fn();
}

describe('App Persistence', () => {
    const mockUseAudio = {
        isLoaded: true,
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

    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        useAudioHook.useAudio.mockReturnValue(mockUseAudio);
        // Reset hash
        window.location.hash = '';
    });

    it('should initialize autoScroll and zoom from localStorage', async () => {
        localStorage.setItem('qb-auto-scroll', 'false');
        localStorage.setItem('qb-zoom', '2');

        render(<App />);

        // Click a signature button
        const sigButton = screen.getByRole('button', { name: /4\/4/i });
        fireEvent.click(sigButton);

        const startButton = screen.getByRole('button', { name: /Confirm & Start/i });
        fireEvent.click(startButton);

        // Now we should be in the sequencer view
        await screen.findByRole('button', { name: /toggle zoom/i });
        const autoScrollToggle = screen.getByRole('button', { name: /toggle auto-scroll/i });

        // Verify initial state was loaded (indirectly via title/aria-labels if available)
        expect(autoScrollToggle).toHaveAttribute('title', 'Auto-scroll OFF');
    });

    it('should save autoScroll to localStorage when toggled', async () => {
        render(<App />);

        // Setup
        fireEvent.click(screen.getByRole('button', { name: /4\/4/i }));
        fireEvent.click(screen.getByRole('button', { name: /Confirm & Start/i }));

        const autoScrollToggle = await screen.findByRole('button', { name: /toggle auto-scroll/i });

        // Initial state is true (default)
        expect(localStorage.getItem('qb-auto-scroll')).toBe('true');

        fireEvent.click(autoScrollToggle);
        expect(localStorage.getItem('qb-auto-scroll')).toBe('false');

        fireEvent.click(autoScrollToggle);
        expect(localStorage.getItem('qb-auto-scroll')).toBe('true');
    });

    it('should save zoom to localStorage when toggled', async () => {
        render(<App />);

        // Setup
        fireEvent.click(screen.getByRole('button', { name: /4\/4/i }));
        fireEvent.click(screen.getByRole('button', { name: /Confirm & Start/i }));

        const zoomToggle = await screen.findByRole('button', { name: /toggle zoom/i });

        // Initial state is 1 (default)
        expect(localStorage.getItem('qb-zoom')).toBe('1');

        fireEvent.click(zoomToggle); // 1 -> 2
        expect(localStorage.getItem('qb-zoom')).toBe('2');

        fireEvent.click(zoomToggle); // 2 -> 0
        expect(localStorage.getItem('qb-zoom')).toBe('0');

        fireEvent.click(zoomToggle); // 0 -> 1
        expect(localStorage.getItem('qb-zoom')).toBe('1');
    });
});
