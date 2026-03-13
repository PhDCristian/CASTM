import { afterEach, describe, expect, it, vi } from 'vitest';
import { cycleHasControlFlow } from '../packages/compiler-front/src/structured-core/lowering/function-expand-helpers/cycle.js';
import { tryParseControlStatement } from '../packages/compiler-front/src/structured-core/statements/control-handler.js';
import { tryExpandIfStatement } from '../packages/compiler-front/src/structured-core/lowering/function-expand-if.js';
import {
  collectBlockFromSource
} from '../packages/compiler-front/src/structured-core/parser-utils/blocks.js';

const span = {
  startLine: 1,
  startColumn: 1,
  endLine: 1,
  endColumn: 2
};

function entry(lineNo: number, cleanLine: string, rawLine = cleanLine) {
  return { lineNo, cleanLine, rawLine };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
  vi.clearAllMocks();
});

describe('branch coverage round 6', () => {
  it('covers cycle-loop handled+break branches via staged mocks', async () => {
    vi.doMock('../packages/compiler-front/src/structured-core/lowering/cycle-loop/steps.js', () => ({
      tryExpandNestedForLoopStep: () => ({
        handled: true,
        statements: [],
        shouldBreak: true,
        nextIndex: 0
      }),
      tryExpandSpatialAtBlockStep: () => ({
        handled: true,
        statements: [],
        shouldBreak: true,
        nextIndex: 0
      }),
      tryExpandSingleCycleStatementStep: () => ({
        handled: true,
        statements: [],
        shouldBreak: true,
        nextIndex: 0
      })
    }));
    vi.doMock('../packages/compiler-front/src/structured-core/parser-utils/numbers.js', async () => {
      const actual = await vi.importActual<any>('../packages/compiler-front/src/structured-core/parser-utils/numbers.js');
      return {
        ...actual,
        applyBindings: (text: string) => (text === 'ERASE_ME' ? '' : text)
      };
    });
    const { expandLoopBody } = await import('../packages/compiler-front/src/structured-core/lowering/cycle-loop.js');

    const fromNestedBreak = expandLoopBody(
      [entry(1, 'anything')],
      new Map(),
      new Map(),
      []
    );
    expect(fromNestedBreak).toEqual([]);

    const fromApplyBindingsEmpty = expandLoopBody(
      [entry(2, 'ERASE_ME')],
      new Map(),
      new Map(),
      []
    );
    expect(fromApplyBindingsEmpty).toEqual([]);
  });

  it('covers control-handler if-without-else and invalid while coordinate fallback', () => {
    const parseNested = () => [];
    const diagnostics: any[] = [];

    const ifNoElse = tryParseControlStatement(
      [
        entry(1, 'if (R0 == IMM(0)) at @0,0 {'),
        entry(2, 'bundle { @0,0: NOP; }'),
        entry(3, '}')
      ],
      0,
      'if (R0 == IMM(0)) at @0,0 {',
      1,
      { value: 0 },
      diagnostics,
      parseNested
    );
    expect(ifNoElse.handled).toBe(true);
    expect((ifNoElse.node as any).elseBody).toBeUndefined();

    const whileBadCoords = tryParseControlStatement(
      [
        entry(1, 'while (R0 < IMM(3)) at @x,y {'),
        entry(2, 'bundle { @0,0: NOP; }'),
        entry(3, '}')
      ],
      0,
      'while (R0 < IMM(3)) at @x,y {',
      1,
      { value: 0 },
      diagnostics,
      parseNested
    );
    expect((whileBadCoords.node as any).control).toEqual({ row: 0, col: 0 });
  });

  it('covers if-expander falseTarget without else branch', () => {
    const diagnostics: any[] = [];
    const outKernel: any = { name: 'k', config: undefined, directives: [], pragmas: [], cycles: [], span };
    const result = tryExpandIfStatement({
      body: [
        entry(1, 'if (R0 == IMM(0)) at @0,0 {'),
        entry(2, 'bundle { @0,0: NOP; }'),
        entry(3, '}')
      ],
      index: 0,
      entry: entry(1, 'if (R0 == IMM(0)) at @0,0 {'),
      clean: 'if (R0 == IMM(0)) at @0,0 {',
      kernel: outKernel,
      functions: new Map(),
      constants: new Map(),
      diagnostics,
      cycleCounter: { value: 0 },
      callStack: [],
      expansionCounter: { value: 0 },
      controlFlowCounter: { value: 0 },
      expandBody: () => {}
    } as any);
    expect(result.handled).toBe(true);
    const branchText = outKernel.cycles[0].statements[0].instruction.text;
    expect(branchText).toContain('__if_end_');
  });

  it('covers cycleHasControlFlow remaining branches', () => {
    const rowNoControl: any = {
      index: 0,
      span,
      statements: [{ kind: 'row', row: 0, instructions: [{ text: 'SADD R0, R0, R1', opcode: 'SADD', operands: [], span }], span }]
    };
    expect(cycleHasControlFlow(rowNoControl)).toBe(false);

    const atControl: any = {
      index: 0,
      span,
      statements: [{ kind: 'at', row: 0, col: 0, instruction: { text: 'JUMP L, ZERO', opcode: 'JUMP', operands: [], span }, span }]
    };
    expect(cycleHasControlFlow(atControl)).toBe(true);
  });

  it('covers collectBlockFromSource nextDepth=0 and unterminated paths', () => {
    const nextDepthZero = collectBlockFromSource(
      ['for i in range(0,2) {', 'x }'],
      0
    );
    expect(nextDepthZero.endIndex).toBe(1);

    const unterminated = collectBlockFromSource(
      ['for i in range(0,2) {', 'x'],
      0
    );
    expect(unterminated.endIndex).toBeNull();
  });

  it('covers compile-driver artifact branches using targeted mocks', async () => {
    const ast: any = {
      targetProfileId: 'uma-cgra-base',
      span,
      kernel: { name: 'k', config: undefined, directives: [], pragmas: [], cycles: [], span }
    };
    const structuredAst: any = {
      targetProfileId: 'uma-cgra-base',
      span,
      functions: [],
      kernel: { name: 'k', config: undefined, directives: [], body: [], span }
    };

    vi.doMock('../packages/compiler-api/src/compiler-driver/parse-driver.js', () => ({
      parse: () => ({ success: true, diagnostics: [], ast, structuredAst })
    }));
    vi.doMock('../packages/compiler-api/src/compiler-driver/analyze-driver.js', () => ({
      analyze: () => ({
        diagnostics: [],
        ast,
        hir: { targetProfileId: 'uma-cgra-base', grid: { rows: 4, cols: 4 }, cycles: [] },
        mir: { targetProfileId: 'uma-cgra-base', grid: { rows: 4, cols: 4 }, cycles: [{ index: 0, slots: [{ row: 0, col: 0, instruction: { opcode: 'NOP', operands: [], text: 'NOP' } }] }] },
        lir: undefined,
        memoryRegions: [],
        ioConfig: { loadAddrs: [], storeAddrs: [] },
        cycleLimit: 3,
        assertions: [],
        symbols: { constants: {}, aliases: {}, labels: {} },
        loweredPasses: ['a', 'b']
      })
    }));
    vi.doMock('../packages/compiler-api/src/compiler-driver/emit-driver.js', () => ({
      emit: () => ({ csv: 'cycle,row,col,instruction\n0,0,0,NOP', diagnostics: [] })
    }));
    const { compile } = await import('../packages/compiler-api/src/compiler-driver/compile-driver.js');
    const full = compile('kernel "k" {}', { emitArtifacts: ['structured', 'ast', 'hir', 'mir', 'csv'] as any });
    expect(full.artifacts.csv).toContain('cycle,row,col');
    expect(full.artifacts.lir).toBeUndefined();
    expect(full.stats.instructions).toBe(1);
    expect(full.stats.cycles).toBe(1);

    vi.resetModules();
    vi.doMock('../packages/compiler-api/src/compiler-driver/parse-driver.js', () => ({
      parse: () => ({ success: true, diagnostics: [], ast, structuredAst: undefined })
    }));
    vi.doMock('../packages/compiler-api/src/compiler-driver/analyze-driver.js', () => ({
      analyze: () => ({
        diagnostics: [],
        ast: { ...ast, kernel: { ...ast.kernel, cycles: [{ index: 9, statements: [], span }] } },
        hir: undefined,
        mir: undefined,
        lir: undefined,
        memoryRegions: [],
        ioConfig: { loadAddrs: [], storeAddrs: [] },
        cycleLimit: undefined,
        assertions: [],
        symbols: { constants: {}, aliases: {}, labels: {} },
        loweredPasses: []
      })
    }));
    vi.doMock('../packages/compiler-api/src/compiler-driver/emit-driver.js', () => ({
      emit: () => ({ csv: '', diagnostics: [] })
    }));
    const mod2 = await import('../packages/compiler-api/src/compiler-driver/compile-driver.js');
    const noMir = mod2.compile('kernel "k" {}', { emitArtifacts: ['ast'] as any });
    expect(noMir.artifacts.csv).toBeUndefined();
    expect(noMir.stats.instructions).toBe(0);
    expect(noMir.stats.cycles).toBe(1);
  });
});
