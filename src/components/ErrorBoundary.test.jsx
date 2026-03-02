// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ErrorBoundary from './ErrorBoundary';

describe('ErrorBoundary', () => {
    let originalLocation;

    beforeEach(() => {
        originalLocation = window.location;

        window.addEventListener = vi.fn();
        window.removeEventListener = vi.fn();

        Object.defineProperty(window, 'location', {
            writable: true,
            value: { pathname: '/' },
        });
    });

    afterEach(() => {
        Object.defineProperty(window, 'location', {
            writable: true,
            value: originalLocation,
        });
    });

    it('should render children when there is no error', () => {
        render(
            <ErrorBoundary>
                <div data-testid="child">Normal content</div>
            </ErrorBoundary>
        );
        expect(screen.getByTestId('child')).toBeInTheDocument();
    });

    it('should render error modal when child throws', () => {
        const ThrowError = () => {
            throw new Error('Test error');
        };

        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        render(
            <ErrorBoundary>
                <ThrowError />
            </ErrorBoundary>
        );

        expect(screen.getByText(/oops/i)).toBeInTheDocument();
        consoleSpy.mockRestore();
    });

    it('should call onGoHome callback when refresh button is clicked', () => {
        const ThrowError = () => {
            throw new Error('Test error');
        };

        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        render(
            <ErrorBoundary>
                <ThrowError />
            </ErrorBoundary>
        );

        const refreshButton = screen.getByRole('button', { name: /go home & refresh/i });
        fireEvent.click(refreshButton);

        expect(window.location.href).toBe('/');
        consoleSpy.mockRestore();
    });

    it('should register global error handlers on mount', () => {
        render(
            <ErrorBoundary>
                <div>Test</div>
            </ErrorBoundary>
        );

        expect(window.addEventListener).toHaveBeenCalledWith('error', expect.any(Function));
        expect(window.addEventListener).toHaveBeenCalledWith('unhandledrejection', expect.any(Function));
    });

    it('should unregister global error handlers on unmount', () => {
        const { unmount } = render(
            <ErrorBoundary>
                <div>Test</div>
            </ErrorBoundary>
        );

        const errorHandler = window.addEventListener.mock.calls.find(c => c[0] === 'error')?.[1];
        const rejectionHandler = window.addEventListener.mock.calls.find(c => c[0] === 'unhandledrejection')?.[1];

        expect(errorHandler).toBeDefined();
        expect(rejectionHandler).toBeDefined();

        unmount();

        expect(window.removeEventListener).toHaveBeenCalledWith('error', errorHandler);
        expect(window.removeEventListener).toHaveBeenCalledWith('unhandledrejection', rejectionHandler);
    });

    it('should show error message when global error event is caught', () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        const { rerender } = render(
            <ErrorBoundary>
                <div>Test</div>
            </ErrorBoundary>
        );

        const errorHandler = window.addEventListener.mock.calls.find(c => c[0] === 'error')?.[1];
        expect(errorHandler).toBeDefined();

        const mockEvent = {
            error: new Error('Global error'),
            preventDefault: vi.fn(),
        };
        errorHandler(mockEvent);

        rerender(
            <ErrorBoundary>
                <div>Test</div>
            </ErrorBoundary>
        );

        expect(screen.getByText(/oops/i)).toBeInTheDocument();
        expect(mockEvent.preventDefault).toHaveBeenCalled();

        consoleSpy.mockRestore();
    });
});
