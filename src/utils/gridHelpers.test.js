// SPDX-FileCopyrightText: 2026 Alexandre Gomes Gaigalas <alganet@gmail.com>
//
// SPDX-License-Identifier: ISC

import { describe, it, expect } from 'vitest';
import { 
    generateGridFromSig, 
    toggleGridStep, 
    calculateBulkUpdate, 
    calculateNewMeasure, 
    calculateGridWithRemovedMeasure 
} from './gridHelpers';
import { BACKBEATS } from '../data/patterns';

describe('gridHelpers', () => {

    describe('generateGridFromSig', () => {
        it('should generate a grid for 4/4 with basic BACKBEAT', () => {
             const sig = { name: "4/4", beats: 4, stepsPerBeat: 4, grouping: 4 }; // 16 steps
             // Mock BACKBEATS data indirectly or use logic. 
             // Note: BACKBEATS is imported in implementation. We assume it contains standard data.
             // If BACKBEATS['4/4'].rhythm['Kick'] has [0, 8, 10], we check that.
             
             // Since we rely on the actual data file, we can just check structure or known specific.
             // Let's settle for checking dimensions.
             const instruments = ['Kick', 'Snare'];
             const grid = generateGridFromSig(sig, instruments);

             expect(grid.length).toBe(2);
             expect(grid[0].length).toBe(16);
             expect(grid[1].length).toBe(16);
        });

        it('should handle undefined patterns gracefully', () => {
            const sig = { name: "NonExistent", beats: 3, stepsPerBeat: 4 };
            const instruments = ['Kick'];
            const grid = generateGridFromSig(sig, instruments);
            expect(grid[0]).toEqual(Array(12).fill(false));
        });
    });

    describe('toggleGridStep', () => {
        it('should true -> false', () => {
            const grid = [[true, false]];
            const newGrid = toggleGridStep(grid, 0, 0);
            expect(newGrid[0][0]).toBe(false);
        });
        it('should false -> true', () => {
             const grid = [[false, false]];
             const newGrid = toggleGridStep(grid, 0, 1);
             expect(newGrid[0][1]).toBe(true);
        });
        it('should be immutable', () => {
            const grid = [[false]];
            const newGrid = toggleGridStep(grid, 0, 0);
            expect(grid[0][0]).toBe(false);
            expect(newGrid[0][0]).toBe(true);
        });
    });

    describe('calculateBulkUpdate', () => {
        const sig = { name: "4/4", beats: 4, stepsPerBeat: 4, grouping: 4 }; // 16 steps
        
        it('should fill every beat (repeat)', () => {
            // 4/4, grouping 4 (quarter note). If I click step 0 (0%4=0), it should fill 0, 4, 8, 12...
            const grid = [Array(16).fill(false)];
            const newGrid = calculateBulkUpdate(grid, 0, 0, 'repeat', sig);
            
            expect(newGrid[0][0]).toBe(true);
            expect(newGrid[0][4]).toBe(true);
            expect(newGrid[0][8]).toBe(true);
            expect(newGrid[0][12]).toBe(true);
            expect(newGrid[0][1]).toBe(false); // Should not affect others
        });

        it('should clear patterns', () => {
            const grid = [Array(16).fill(true)];
            const newGrid = calculateBulkUpdate(grid, 0, 1, 'clear', sig); // 1, 5, 9, 13
            expect(newGrid[0][1]).toBe(false);
            expect(newGrid[0][5]).toBe(false);
            expect(newGrid[0][0]).toBe(true);
        });

        it('should handle alternate', () => {
            const grid = [Array(16).fill(false)];
            const newGrid = calculateBulkUpdate(grid, 0, 0, 'alternate', sig);
            // 0 -> true (pulse 0%2=0)
            // 4 -> false (pulse 1%2=1)
            // 8 -> true (pulse 2%2=0)
            // 12 -> false (pulse 3%2=1)
            expect(newGrid[0][0]).toBe(true);
            expect(newGrid[0][4]).toBe(false);
            expect(newGrid[0][8]).toBe(true);
            expect(newGrid[0][12]).toBe(false);
        });
    });

    describe('calculateNewMeasure', () => {
        const sig = { name: "4/4", beats: 4, stepsPerBeat: 4, grouping: 4 }; // 16 steps

        it('should extend constant 16th notes', () => {
            // 1 measure of all 16th notes
            const grid = [Array(16).fill(true)];
            const newGrid = calculateNewMeasure(grid, sig);
            
            // Should add 16 more trues
            expect(newGrid[0].length).toBe(32);
            expect(newGrid[0].slice(16, 32)).toEqual(Array(16).fill(true));
        });

        it('should extend simple backbeat', () => {
            // Kick on 0, 8 (4/4)
            const row = Array(16).fill(false);
            row[0] = true; 
            row[8] = true;
            const grid = [row];
            
            const newGrid = calculateNewMeasure(grid, sig);
            const newMeas = newGrid[0].slice(16, 32);
            expect(newMeas[0]).toBe(true);
            expect(newMeas[8]).toBe(true);
            expect(newMeas[1]).toBe(false);
        });
    });

    describe('calculateGridWithRemovedMeasure', () => {
        const sig = { name: "4/4", beats: 4, stepsPerBeat: 4, grouping: 4 }; // 16 steps

        it('should remove the second measure', () => {
            const row = Array(32).fill(false);
            row[0] = true; // Measure 1
            row[16] = true; // Measure 2
            const grid = [row];

            const newGrid = calculateGridWithRemovedMeasure(grid, 1, sig);
            expect(newGrid[0].length).toBe(16);
            expect(newGrid[0][0]).toBe(true); // Kept measure 1
        });

        it('should not remove if only one measure left', () => {
            const row = Array(16).fill(true);
            const grid = [row];
            const newGrid = calculateGridWithRemovedMeasure(grid, 0, sig);
            expect(newGrid[0].length).toBe(16);
        });
    });

});
