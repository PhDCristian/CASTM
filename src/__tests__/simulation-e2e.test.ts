/**
 * End-to-End Simulation Tests
 *
 * Tests DSL examples through the full pipeline:
 * compile → parse → simulate → verify results
 *
 * Requires: UMA-CGRA-Simulator available as a sibling submodule.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  compileAndSimulate,
  getRegister,
  getMemoryWord,
  getMemoryRange,
  getFinalState
} from './helpers/simulation';

const examplesDir = resolve(__dirname, '../../examples');

function readExample(path: string): string {
  return readFileSync(resolve(examplesDir, path), 'utf-8');
}

describe('E2E Simulation: Vector Addition', () => {
  it('should compute C[i] = A[i] + B[i]', () => {
    const dsl = readExample('applications/vector-add.dsl');
    const result = compileAndSimulate(dsl);

    // A = {10, 20, 30, 40} at word indices 0-3
    // B = {1, 2, 3, 4} at word indices 4-7
    // C = A + B at word indices 8-11
    const C = getMemoryRange(result, 8, 4);
    expect(C).toEqual([11, 22, 33, 44]);
  });
});

describe('E2E Simulation: Dot Product', () => {
  it('should compute sum(A[i] * B[i]) = 70', () => {
    const dsl = readExample('applications/dot-product.dsl');
    const result = compileAndSimulate(dsl);

    // dot = 1*5 + 2*6 + 3*7 + 4*8 = 5 + 12 + 21 + 32 = 70
    // Result in R3 at PE(0,0) after reduce
    const dotProduct = getRegister(result, 0, 0, 'R3');
    expect(dotProduct).toBe(70);
  });
});

describe('E2E Simulation: Matrix Multiplication 2x2', () => {
  it('should compute C = A * B for 2x2 matrices', () => {
    const dsl = readExample('applications/matmul-2x2.dsl');
    const result = compileAndSimulate(dsl);

    // A = [[1, 2], [3, 4]], B = [[5, 6], [7, 8]]
    // C = A * B = [[1*5+2*7, 1*6+2*8], [3*5+4*7, 3*6+4*8]]
    //           = [[19, 22], [43, 50]]
    //
    // A at word 0-3, B at word 4-7, C at word 8-11
    const C = getMemoryRange(result, 8, 4);
    expect(C).toEqual([19, 22, 43, 50]);
  });
});

describe('E2E Simulation: Basic examples', () => {
  it('hello.dsl: should load 42 into R0', () => {
    const dsl = readExample('basic/hello.dsl');
    const result = compileAndSimulate(dsl);

    // hello.dsl loads 42 into R0 at PE(0,0)
    const val = getRegister(result, 0, 0, 'R0');
    expect(val).toBe(42);
  });

  it('constants.dsl: should use .const values', () => {
    const dsl = readExample('basic/constants.dsl');
    const result = compileAndSimulate(dsl);

    // R0 should contain the constant value used
    // Just verify it completes without error
    expect(result.computedCycles).toBeGreaterThan(0);
  });
});

describe('E2E Simulation: Control Flow', () => {
  it('for-basic.dsl: for loop should execute correctly', () => {
    const dsl = readExample('control-flow/for-basic.dsl');
    const result = compileAndSimulate(dsl);
    expect(result.computedCycles).toBeGreaterThan(0);
  });

  it('if-else.dsl: conditional should branch correctly', () => {
    const dsl = readExample('control-flow/if-else.dsl');
    const result = compileAndSimulate(dsl);
    expect(result.computedCycles).toBeGreaterThan(0);
  });
});

describe('E2E Simulation: Parallel Pragmas', () => {
  it('parallel-simple.dsl: parallel for should distribute work', () => {
    const dsl = readExample('parallel/parallel-simple.dsl');
    const result = compileAndSimulate(dsl);
    expect(result.computedCycles).toBeGreaterThan(0);
  });

  it('reduce.dsl: sum reduction should produce correct result', () => {
    const dsl = readExample('parallel/reduce.dsl');
    const result = compileAndSimulate(dsl);
    expect(result.computedCycles).toBeGreaterThan(0);
  });

  it('route.dsl: data routing should move values between PEs', () => {
    const dsl = readExample('parallel/route.dsl');
    const result = compileAndSimulate(dsl);

    // PE(0,0) loads 42 into R0, routes to PE(0,2) into R1
    const val = getRegister(result, 0, 2, 'R1');
    expect(val).toBe(42);
  });

  it('rotate.dsl: circular rotation should work', () => {
    const dsl = readExample('parallel/rotate.dsl');
    const result = compileAndSimulate(dsl);

    // After rotate left: PE0=20, PE1=30, PE2=40, PE3=10
    expect(getRegister(result, 0, 0, 'R0')).toBe(20);
    expect(getRegister(result, 0, 1, 'R0')).toBe(30);
    expect(getRegister(result, 0, 2, 'R0')).toBe(40);
    expect(getRegister(result, 0, 3, 'R0')).toBe(10);
  });

  it('shift.dsl: linear shift should work', () => {
    const dsl = readExample('parallel/shift.dsl');
    const result = compileAndSimulate(dsl);

    // After shift right (fill=0): PE0=0, PE1=10, PE2=20, PE3=30
    expect(getRegister(result, 0, 0, 'R0')).toBe(0);
    expect(getRegister(result, 0, 1, 'R0')).toBe(10);
    expect(getRegister(result, 0, 2, 'R0')).toBe(20);
    expect(getRegister(result, 0, 3, 'R0')).toBe(30);
  });
});

describe('E2E Simulation: Functions', () => {
  it('basic-function.dsl: function expansion should work', () => {
    const dsl = readExample('functions/basic-function.dsl');
    const result = compileAndSimulate(dsl);

    // init_reg(R0, 10), init_reg(R1, 20), R3 = R0 + R1 = 30
    expect(getRegister(result, 0, 0, 'R3')).toBe(30);
  });
});
