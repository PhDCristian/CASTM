/**
 * Barrett Modular Squaring Tests
 * 
 * Comprehensive test suite for barrett_v2.edsl
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import { compileDslToCsv } from '@utils/dsl-compiler';
import { parseProgram } from '../../simulation/instruction';
import { runSimulation, MemoryRegion } from '../../simulation/simulation';

// Read and compile the Barrett kernel once
const barrettCode = fs.readFileSync('./examples/dsl_port/barrett_v2.edsl', 'utf-8');
const compileResult = compileDslToCsv(barrettCode);

if (!compileResult.success) {
    throw new Error(`Failed to compile Barrett kernel: ${compileResult.error} at line ${compileResult.line}`);
}

const program = parseProgram(compileResult.csv!);

// Helper to run simulation with given input
function runBarrettSquare(x: number): {
    result: number;
    products: { s00: number; s01: number; s11: number };
    coefficients: { c0: number; c1: number; c2: number };
    limbs: { L0: number; L1: number; L2: number; L3: number };
} {
    const memoryInit: MemoryRegion[] = [
        { start: 0, values: [x] },           // X at address 0
        { start: 4, values: [0x78000001] },  // P (BabyBear prime)
        { start: 16, values: [0x17FFF] },    // μ
    ];

    const sim = runSimulation({
        program,
        memoryRegions: memoryInit,
        limit: 300,
    });

    const finalState = sim.state[sim.state.length - 1];
    const mem = (addr: number) => finalState?.memory[addr / 4] || 0;

    return {
        result: mem(700),
        products: {
            s00: mem(400),
            s01: mem(404),
            s11: mem(416),
        },
        coefficients: {
            c0: mem(300),
            c1: mem(304),
            c2: mem(308),
        },
        limbs: {
            L0: mem(360),
            L1: mem(364),
            L2: mem(368),
            L3: mem(372),
        },
    };
}

describe('Barrett Squaring - Compilation', () => {
    it('should compile successfully', () => {
        expect(compileResult.success).toBe(true);
        expect(compileResult.csv).toBeDefined();
    });
});

describe('Barrett Squaring - Simple Cases', () => {
    it('should compute 0² = 0', () => {
        const result = runBarrettSquare(0);
        expect(result.result).toBe(0);
    });

    it('should compute 1² = 1', () => {
        const result = runBarrettSquare(1);
        expect(result.result).toBe(1);
    });

    it('should compute 2² = 4', () => {
        const result = runBarrettSquare(2);
        expect(result.result).toBe(4);
    });

    it('should compute 100² = 10000', () => {
        const result = runBarrettSquare(100);
        expect(result.result).toBe(10000);
    });

    it('should compute 255² = 65025 (max single byte)', () => {
        const result = runBarrettSquare(255);
        expect(result.result).toBe(65025);
    });
});

describe('Barrett Squaring - Multi-byte Cases', () => {
    it('should compute 0x1234² correctly', () => {
        const x = 0x1234;
        const expected = x * x;
        const result = runBarrettSquare(x);

        expect(result.products.s00).toBe((x & 0xFF) * (x & 0xFF));
        expect(result.products.s01).toBe((x & 0xFF) * ((x >> 8) & 0xFF));
        expect(result.result).toBe(expected);
    });

    it('should compute 0x100² = 65536 (byte boundary)', () => {
        const result = runBarrettSquare(0x100);
        expect(result.result).toBe(65536);
    });

    it('should compute 0x7FFF² correctly (within 32-bit range)', () => {
        // 0x7FFF² = 1073676289, fits in 32 bits
        const x = 0x7FFF;
        const expected = x * x;
        const result = runBarrettSquare(x);
        expect(result.result).toBe(expected);
    });
});

describe('Barrett Squaring - Coefficient Computation', () => {
    it('should compute c0 = s00', () => {
        const x = 0x1234;
        const A0 = x & 0xFF;
        const result = runBarrettSquare(x);
        expect(result.coefficients.c0).toBe(A0 * A0);
    });

    it('should compute c1 = 2*s01', () => {
        const x = 0x1234;
        const A0 = x & 0xFF;
        const A1 = (x >> 8) & 0xFF;
        const result = runBarrettSquare(x);
        expect(result.coefficients.c1).toBe(2 * A0 * A1);
    });

    it('should compute c2 = s11 for simple cases', () => {
        const x = 0x1234;
        const A1 = (x >> 8) & 0xFF;
        const result = runBarrettSquare(x);
        expect(result.coefficients.c2).toBe(A1 * A1);
    });
});

describe('Barrett Squaring - Limb Conversion', () => {
    it('should properly propagate carry for large coefficients', () => {
        const x = 0xFF00; // A0=0, A1=255
        const result = runBarrettSquare(x);

        // c0 = 0, c1 = 0, c2 = 65025
        // L0_raw = 0 + 0 = 0
        // L1_raw = 65025 + 0 = 65025
        // L1 = 65025 (no carry since fits in 16 bits)
        expect(result.limbs.L0).toBe(0);
        expect(result.limbs.L1).toBe(65025);
        // Note: 0xFF00 * 0xFF00 = 4261478400, which overflows 32-bit signed
        // Check via unsigned comparison
        expect(result.result >>> 0).toBe((0xFF00 * 0xFF00) >>> 0);
    });

    it('should handle multi-byte input with carry', () => {
        // Test a case with significant carry propagation
        const x = 0x1234;
        const result = runBarrettSquare(x);

        // Expected: limbs form the correct product
        const expectedProduct = x * x;
        expect(result.limbs.L0 + result.limbs.L1 * 65536).toBe(expectedProduct);
    });
});
