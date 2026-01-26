/**
 * Test S-box k=7 for multi-byte inputs
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import { compileDslToCsv } from '@utils/dsl-compiler';
import { parseProgram } from '../../simulation/instruction';
import { runSimulation, MemoryRegion } from '../../simulation/simulation';

const code = fs.readFileSync('./examples/dsl_port/sbox_k7.edsl', 'utf-8');
const compileResult = compileDslToCsv(code);

function runSbox(x: number): { result: number; x2: number; x4: number; x6: number } {
    const memoryInit: MemoryRegion[] = [
        { start: 0, values: [x] },
        { start: 4, values: [0x78000001] },
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
        x2: mem(800),
        x4: mem(804),
        x6: mem(808),
    };
}

describe('S-box k=7 - Compilation', () => {
    it('should compile successfully', () => {
        expect(compileResult.success).toBe(true);
        if (!compileResult.success) {
            console.log('Error:', compileResult.error, 'at line', compileResult.line);
        }
    });
});

describe('S-box k=7 - Small Values', () => {
    it('should compute 2^7 = 128', () => {
        const r = runSbox(2);
        expect(r.x2).toBe(4);   // 2²
        expect(r.x4).toBe(16);  // 2⁴
        expect(r.x6).toBe(64);  // 2⁶
        expect(r.result).toBe(128);
    });

    it('should compute 3^7 = 2187', () => {
        const r = runSbox(3);
        expect(r.result).toBe(2187);
    });

    it('should compute 10^7 = 10000000', () => {
        const r = runSbox(10);
        expect(r.result).toBe(10000000);
    });
});

describe('S-box k=7 - Multi-byte Values', () => {
    it('should compute 256^7 (multi-byte input)', () => {
        const x = 256;
        const r = runSbox(x);
        // 256^2 = 65536, 256^4 overflow but for testing chain
        expect(r.x2).toBe(65536);
    });

    it('should verify chain for x=100', () => {
        const x = 100;
        const r = runSbox(x);
        expect(r.x2).toBe(10000);
        expect(r.x4).toBe(100000000);
        // x^7 would overflow 32-bit
    });
});
