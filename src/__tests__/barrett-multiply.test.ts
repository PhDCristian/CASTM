/**
 * Test Barrett Multiplication: x * y mod p
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import { compileDslToCsv } from '@utils/dsl-compiler';
import { parseProgram } from '../../simulation/instruction';
import { runSimulation, MemoryRegion } from '../../simulation/simulation';

// Compile once
const code = fs.readFileSync('./examples/dsl_port/barrett_multiply.edsl', 'utf-8');
const compileResult = compileDslToCsv(code);

function runMultiply(x: number, y: number): {
    result: number;
    limbs: { L0: number; L1: number };
} {
    const memoryInit: MemoryRegion[] = [
        { start: 0, values: [x] },           // X
        { start: 4, values: [y] },           // Y
        { start: 8, values: [0x78000001] },  // P
    ];

    const program = parseProgram(compileResult.csv!);
    const sim = runSimulation({
        program,
        memoryRegions: memoryInit,
        limit: 300,
    });

    const finalState = sim.state[sim.state.length - 1];
    const mem = (addr: number) => finalState?.memory[addr / 4] || 0;

    return {
        result: mem(700),
        limbs: {
            L0: mem(360),
            L1: mem(364),
        },
    };
}

describe('Barrett Multiplication - Compilation', () => {
    it('should compile successfully', () => {
        expect(compileResult.success).toBe(true);
    });
});

describe('Barrett Multiplication - Simple Cases', () => {
    it('should compute 0 * 0 = 0', () => {
        const r = runMultiply(0, 0);
        expect(r.result).toBe(0);
    });

    it('should compute 1 * 1 = 1', () => {
        const r = runMultiply(1, 1);
        expect(r.result).toBe(1);
    });

    it('should compute 2 * 3 = 6', () => {
        const r = runMultiply(2, 3);
        expect(r.result).toBe(6);
    });

    it('should compute 100 * 100 = 10000', () => {
        const r = runMultiply(100, 100);
        expect(r.result).toBe(10000);
    });

    it('should compute 255 * 255 = 65025', () => {
        const r = runMultiply(255, 255);
        expect(r.result).toBe(65025);
    });
});

describe('Barrett Multiplication - Multi-byte', () => {
    it('should compute 0x100 * 0x100 = 65536', () => {
        const r = runMultiply(0x100, 0x100);
        expect(r.result).toBe(65536);
    });

    it('should compute 0x1234 * 1 = 0x1234', () => {
        const r = runMultiply(0x1234, 1);
        expect(r.result).toBe(0x1234);
    });

    it('should compute 100 * 200 = 20000', () => {
        const r = runMultiply(100, 200);
        expect(r.result).toBe(20000);
    });
});
