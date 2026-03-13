import { describe, expect, it } from 'vitest';
import { spanAt } from '@castm/compiler-ir';
import { expandStaticForLoop } from '../packages/compiler-front/src/structured-core/lowering/for-expand-static.js';

function entry(lineNo: number, cleanLine: string) {
  return { lineNo, cleanLine, rawLine: cleanLine };
}

function makeKernel() {
  return {
    name: 'k',
    config: undefined,
    directives: [],
    pragmas: [],
    cycles: [],
    span: spanAt(1, 1, 1)
  };
}

function makeCallbacks() {
  return {
    cycleHasControlFlow: () => false,
    cloneCycle: (cycle: any, index: number) => ({ ...cycle, index }),
    parseInstruction: () => ({ text: 'NOP', opcode: 'NOP', operands: [], span: spanAt(1, 1, 1) }),
    makeControlCycle: () => ({ index: 0, span: spanAt(1, 1, 1), statements: [] }),
    expandFunctionBodyIntoKernel: () => {}
  };
}

describe('compiler-front for-expand-static branch coverage', () => {
  it('rejects runtime collapse plan in static expander entry point', () => {
    const diagnostics: any[] = [];
    const kernel = makeKernel();

    expandStaticForLoop({
      header: {
        variable: 'R0',
        start: 0,
        end: 2,
        step: 1,
        runtime: true,
        control: { row: 0, col: 0 },
        collapseLevels: 2
      },
      loopBody: [entry(2, 'bundle { @0,0: NOP; }')],
      lineNo: 1,
      lineLength: 40,
      kernel,
      functions: new Map(),
      constants: new Map(),
      diagnostics,
      cycleCounter: { value: 0 },
      callStack: [],
      expansionCounter: { value: 0 },
      controlFlowCounter: { value: 0 },
      callbacks: makeCallbacks()
    } as any);

    expect(kernel.cycles).toHaveLength(0);
    expect(diagnostics.some((d) => d.message.includes('collapse(n) is not supported'))).toBe(true);
  });

  it('rejects collapse plan when nested loops are missing', () => {
    const diagnostics: any[] = [];
    const kernel = makeKernel();

    expandStaticForLoop({
      header: {
        variable: 'i',
        start: 0,
        end: 2,
        step: 1,
        collapseLevels: 2
      },
      loopBody: [],
      lineNo: 1,
      lineLength: 30,
      kernel,
      functions: new Map(),
      constants: new Map(),
      diagnostics,
      cycleCounter: { value: 0 },
      callStack: [],
      expansionCounter: { value: 0 },
      controlFlowCounter: { value: 0 },
      callbacks: makeCallbacks()
    } as any);

    expect(kernel.cycles).toHaveLength(0);
    expect(diagnostics.some((d) => d.message.includes('requires 2 nested static for-loops'))).toBe(true);
  });

  it('rejects nested runtime/control loops inside collapse regions', () => {
    const diagnostics: any[] = [];
    const kernel = makeKernel();

    expandStaticForLoop({
      header: {
        variable: 'i',
        start: 0,
        end: 2,
        step: 1,
        collapseLevels: 2
      },
      loopBody: [
        entry(10, 'for R0 in range(0, 2) at @0,0 runtime {'),
        entry(11, 'bundle { @0,0: NOP; }'),
        entry(12, '}')
      ],
      lineNo: 9,
      lineLength: 48,
      kernel,
      functions: new Map(),
      constants: new Map([['N', 2]]),
      diagnostics,
      cycleCounter: { value: 0 },
      callStack: [],
      expansionCounter: { value: 0 },
      controlFlowCounter: { value: 0 },
      callbacks: makeCallbacks()
    } as any);

    expect(kernel.cycles).toHaveLength(0);
    expect(diagnostics.some((d) => d.message.includes('supports only static nested for-loops'))).toBe(true);
  });

  it('rejects unterminated nested loops in collapse regions', () => {
    const diagnostics: any[] = [];
    const kernel = makeKernel();

    expandStaticForLoop({
      header: {
        variable: 'i',
        start: 0,
        end: 2,
        step: 1,
        collapseLevels: 2
      },
      loopBody: [
        entry(20, 'for j in range(0, 2) {'),
        entry(21, 'bundle { @0,0: NOP; }')
      ],
      lineNo: 19,
      lineLength: 32,
      kernel,
      functions: new Map(),
      constants: new Map(),
      diagnostics,
      cycleCounter: { value: 0 },
      callStack: [],
      expansionCounter: { value: 0 },
      controlFlowCounter: { value: 0 },
      callbacks: makeCallbacks()
    } as any);

    expect(kernel.cycles).toHaveLength(0);
    expect(diagnostics.some((d) => d.message.includes('Unterminated nested for-loop'))).toBe(true);
  });

  it('rejects non-perfect nesting while tolerating empty sibling lines', () => {
    const diagnostics: any[] = [];
    const kernel = makeKernel();

    expandStaticForLoop({
      header: {
        variable: 'i',
        start: 0,
        end: 2,
        step: 1,
        collapseLevels: 2
      },
      loopBody: [
        entry(30, 'for j in range(0, 2) {'),
        entry(31, 'bundle { @0,0: NOP; }'),
        entry(32, '}'),
        entry(33, ''),
        entry(34, 'bundle { @0,1: NOP; }')
      ],
      lineNo: 29,
      lineLength: 36,
      kernel,
      functions: new Map(),
      constants: new Map(),
      diagnostics,
      cycleCounter: { value: 0 },
      callStack: [],
      expansionCounter: { value: 0 },
      controlFlowCounter: { value: 0 },
      callbacks: makeCallbacks()
    } as any);

    expect(kernel.cycles).toHaveLength(0);
    expect(diagnostics.some((d) => d.message.includes('perfectly nested loops'))).toBe(true);
  });

  it('rejects collapsed plans that exceed max iteration budget', () => {
    const diagnostics: any[] = [];
    const kernel = makeKernel();

    expandStaticForLoop({
      header: {
        variable: 'i',
        start: 0,
        end: 200_001,
        step: 1,
        collapseLevels: 2
      },
      loopBody: [
        entry(40, 'for j in range(0, 1) {'),
        entry(41, 'bundle { @0,0: NOP; }'),
        entry(42, '}')
      ],
      lineNo: 39,
      lineLength: 40,
      kernel,
      functions: new Map(),
      constants: new Map(),
      diagnostics,
      cycleCounter: { value: 0 },
      callStack: [],
      expansionCounter: { value: 0 },
      controlFlowCounter: { value: 0 },
      callbacks: makeCallbacks()
    } as any);

    expect(kernel.cycles).toHaveLength(0);
    expect(diagnostics.some((d) => d.message.includes('exceeds max supported iterations'))).toBe(true);
  });
});
