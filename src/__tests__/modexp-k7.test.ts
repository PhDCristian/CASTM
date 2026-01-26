/**
 * Test Modular Exponentiation: x^7
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import { compileDslToCsv } from '@utils/dsl-compiler';
import { parseProgram } from '../../simulation/instruction';
import { runSimulation, MemoryRegion } from '../../simulation/simulation';

const code = fs.readFileSync('./examples/dsl_port/modexp_k7.edsl', 'utf-8');
const compileResult = compileDslToCsv(code);

function runModExp(x: number): number {
    const memoryInit: MemoryRegion[] = [
        { start: 0, values: [x] },
        { start: 4, values: [0x78000001] },
        { start: 8, values: [7] },
    ];

    const program = parseProgram(compileResult.csv!);
    const sim = runSimulation({
        program,
        memoryRegions: memoryInit,
        limit: 200,
    });

    const finalState = sim.state[sim.state.length - 1];
    return finalState?.memory[700 / 4] || 0;
}

describe('ModExp k=7 - Compilation', () => {
    it('should compile successfully', () => {
        expect(compileResult.success).toBe(true);
    });
});

describe('ModExp k=7 - Small Values', () => {
    it('should compute 0^7 = 0', () => {
        expect(runModExp(0)).toBe(0);
    });

    it('should compute 1^7 = 1', () => {
        expect(runModExp(1)).toBe(1);
    });

    it('should compute 2^7 = 128', () => {
        expect(runModExp(2)).toBe(128);
    });

    it('should compute 3^7 = 2187', () => {
        expect(runModExp(3)).toBe(2187);
    });

    it('should compute 10^7 = 10000000', () => {
        expect(runModExp(10)).toBe(10000000);
    });
});

describe('ModExp k=7 - Boundary Values', () => {
    it('should compute 15^7 correctly', () => {
        const expected = Math.pow(15, 7);
        expect(runModExp(15)).toBe(expected);
    });
});
