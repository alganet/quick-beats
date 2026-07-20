// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ConfirmBar from './ConfirmBar';

describe('ConfirmBar', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    it('renders the correct message with measure index', () => {
        render(<ConfirmBar measureIndex={2} onConfirm={() => {}} onCancel={() => {}} />);
        expect(screen.getByText('Delete section 3?')).toBeInTheDocument();
    });

    it('calls onConfirm when "Yes" is clicked', () => {
        const onConfirm = vi.fn();
        const onCancel = vi.fn();
        render(<ConfirmBar measureIndex={0} onConfirm={onConfirm} onCancel={onCancel} />);
        
        fireEvent.click(screen.getByText('Yes'));
        expect(onConfirm).toHaveBeenCalledTimes(1);
        expect(onCancel).not.toHaveBeenCalled();
    });

    it('calls onCancel when "No" is clicked', () => {
        const onConfirm = vi.fn();
        const onCancel = vi.fn();
        render(<ConfirmBar measureIndex={0} onConfirm={onConfirm} onCancel={onCancel} />);
        
        fireEvent.click(screen.getByText('No'));
        expect(onCancel).toHaveBeenCalledTimes(1);
        expect(onConfirm).not.toHaveBeenCalled();
    });

    it('does not auto-dismiss on a timer (WCAG 2.2.1)', () => {
        const onCancel = vi.fn();
        render(<ConfirmBar measureIndex={0} onConfirm={() => {}} onCancel={onCancel} />);

        act(() => {
            vi.advanceTimersByTime(10000);
        });

        // The confirmation stays put; only Yes/No resolves it.
        expect(onCancel).not.toHaveBeenCalled();
    });

    it('cancels on Escape, from anywhere', () => {
        // With the timer gone, Escape is the passive way out of an accidental
        // tap — the pending measure is faded and locked until resolved.
        const onCancel = vi.fn();
        render(<ConfirmBar measureIndex={0} onConfirm={() => {}} onCancel={onCancel} />);

        fireEvent.keyDown(window, { key: 'Escape' });
        expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('stops listening for Escape once unmounted', () => {
        const onCancel = vi.fn();
        const { unmount } = render(<ConfirmBar measureIndex={0} onConfirm={() => {}} onCancel={onCancel} />);
        unmount();

        fireEvent.keyDown(window, { key: 'Escape' });
        expect(onCancel).not.toHaveBeenCalled();
    });
});
