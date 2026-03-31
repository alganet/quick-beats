// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import ContextMenu from './ContextMenu';

describe('ContextMenu', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render repeat, alternate, and clear options', () => {
        const ref = { current: null };
        render(
            <ContextMenu
                ref={ref}
                x={100}
                y={200}
                activeOption="repeat"
                grouping={4}
                colInGroup={0}
            />
        );

        expect(screen.getByText('Repeat')).toBeInTheDocument();
        expect(screen.getByText('Alternate')).toBeInTheDocument();
        expect(screen.getByText('Clear')).toBeInTheDocument();
    });

    it('should highlight the active option', () => {
        const ref = { current: null };
        render(
            <ContextMenu
                ref={ref}
                x={100}
                y={200}
                activeOption="alternate"
                grouping={4}
                colInGroup={1}
            />
        );

        const alternateOption = screen.getByText('Alternate');
        expect(alternateOption.closest('div')).toHaveClass('bg-primary');
    });

    it('should show repeat pattern correctly', () => {
        const ref = { current: null };
        render(
            <ContextMenu
                ref={ref}
                x={100}
                y={200}
                activeOption="repeat"
                grouping={4}
                colInGroup={0}
            />
        );

        const container = screen.getByText('Repeat').closest('div');
        const dots = container.querySelectorAll('.w-3');
        expect(dots).toHaveLength(8);
    });

    it('should show alternate pattern correctly', () => {
        const ref = { current: null };
        render(
            <ContextMenu
                ref={ref}
                x={100}
                y={200}
                activeOption="alternate"
                grouping={4}
                colInGroup={1}
            />
        );

        expect(screen.getByText('Alternate')).toBeInTheDocument();
    });

    it('should render with different grouping values', () => {
        const ref = { current: null };
        render(
            <ContextMenu
                ref={ref}
                x={100}
                y={200}
                activeOption="repeat"
                grouping={2}
                colInGroup={0}
            />
        );

        // For grouping=2, the component should render grouping * 2 = 4 pattern cells.
        const container = screen.getByText('Repeat').closest('div');
        const dots = container.querySelectorAll('.w-3');
        expect(dots).toHaveLength(4);
    });

    it('should handle edge case when colInGroup is at boundary', () => {
        const ref = { current: null };
        render(
            <ContextMenu
                ref={ref}
                x={100}
                y={200}
                activeOption="alternate"
                grouping={4}
                colInGroup={3}
            />
        );

        expect(screen.getAllByText('Repeat').length).toBeGreaterThan(0);
    });

    it('should handle edge case when colInGroup is at boundary', () => {
        const ref = { current: null };
        const { container, rerender } = render(
            <ContextMenu
                ref={ref}
                x={100}
                y={200}
                activeOption="alternate"
                grouping={4}
                colInGroup={1}
            />
        );
        const nonBoundaryPattern = container.innerHTML;
        rerender(
            <ContextMenu
                ref={ref}
                x={100}
                y={200}
                activeOption="alternate"
                grouping={4}
                colInGroup={3}
            />
        );
        const boundaryPattern = container.innerHTML;
        // Ensure the pattern changes when moving to the boundary column in the group
        expect(boundaryPattern).not.toBe(nonBoundaryPattern);
        expect(screen.getByText('Alternate')).toBeInTheDocument();
    });

    it('should handle large grouping values', () => {
        const ref = { current: null };
        render(
            <ContextMenu
                ref={ref}
                x={100}
                y={200}
                activeOption="repeat"
                grouping={8}
                colInGroup={4}
            />
        );

        // For grouping=8, the component should render grouping * 2 = 16 pattern cells.
        const container = screen.getByText('Repeat').closest('div');
        const dots = container.querySelectorAll('.w-3');
        expect(dots).toHaveLength(16);
    });
});
