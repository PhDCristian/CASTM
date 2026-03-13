import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  Diagnostic,
  ErrorCodes,
  makeDiagnostic,
  spanAt
} from '@castm/compiler-ir';
import { parseBroadcastPragmaArgs } from '../packages/compiler-api/src/passes-shared/advanced-args/broadcast.js';
import { buildReduceCycles } from '../packages/compiler-api/src/passes-shared/collective-reduce.js';
import { buildRouteTransferCycles } from '../packages/compiler-api/src/passes-shared/route-transfer.js';
import { tryParseControlStatement } from '../packages/compiler-front/src/structured-core/statements/control-handler.js';
import { tryExpandIfStatement } from '../packages/compiler-front/src/structured-core/lowering/function-expand-if.js';
import { tryExpandWhileStatement } from '../packages/compiler-front/src/structured-core/lowering/function-expand-while.js';
import { expandFunctionBodyIntoKernel } from '../packages/compiler-front/src/structured-core/lowering/function-expand.js';
import { emitWhileControlFlowCycles } from '../packages/compiler-front/src/structured-core/lowering/control-flow-emit/while-cycles.js';
import { resolveGrid } from '../packages/compiler-api/src/compiler-driver/grid-resolver.js';

const span = spanAt(1, 1, 1);

function entry(lineNo: number, cleanLine: string, rawLine = cleanLine) {
  return { lineNo, cleanLine, rawLine };
}

function kernel() {
  return {
    name: 'k',
    config: undefined,
    directives: [],
    pragmas: [],
    cycles: [],
    span
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
  vi.clearAllMocks();
});

describe('branch coverage round 3', () => {
  it('covers broadcast fallback parser path and invalids', () => {
    expect(parseBroadcastPragmaArgs('broadcast(value=R1, from=@0,0, to=diag)')).toBeNull();
    expect(parseBroadcastPragmaArgs('broadcast(value=R1, from=@bad, to=row)')).toBeNull();
  });

  it('covers broadcast fallback success path via parser-utils mock', async () => {
    vi.doMock('../packages/compiler-api/src/passes-shared/pragma-args-utils.js', async () => {
      const actual = await vi.importActual<any>('../packages/compiler-api/src/passes-shared/pragma-args-utils.js');
      return {
        ...actual,
        parseKeyValueArgs: () => new Map([
          ['value', 'R1'],
          ['from', '@0,0'],
          ['to', 'column']
        ])
      };
    });
    const mod = await import('../packages/compiler-api/src/passes-shared/advanced-args/broadcast.js');
    expect(mod.parseBroadcastPragmaArgs('broadcast(any_order_here)')).toMatchObject({
      valueReg: 'R1',
      scope: 'column',
      from: { row: 0, col: 0 }
    });
  });

  it('covers reduce lanes<=0 and mocked scratch allocation failure', async () => {
    const lanesEmpty = buildReduceCycles(
      { operation: 'add', destReg: 'R1', srcReg: 'R0', axis: 'row' },
      0,
      { rows: 4, cols: 0, topology: 'mesh', wrapPolicy: 'clamp' } as any,
      span,
      []
    );
    expect(lanesEmpty).toEqual([]);

    vi.doMock('../packages/compiler-api/src/passes-shared/collective-scan-reduce-helpers.js', async () => {
      const actual = await vi.importActual<any>('../packages/compiler-api/src/passes-shared/collective-scan-reduce-helpers.js');
      return {
        ...actual,
        pickScratchRegisters: () => null
      };
    });
    const mod = await import('../packages/compiler-api/src/passes-shared/collective-reduce.js');
    const diagnostics: Diagnostic[] = [];
    const reduced = mod.buildReduceCycles(
      { operation: 'add', destReg: 'R1', srcReg: 'R0', axis: 'row' },
      0,
      { rows: 4, cols: 4, topology: 'torus', wrapPolicy: 'wrap' } as any,
      span,
      diagnostics
    );
    expect(reduced).toEqual([]);
    expect(diagnostics.at(-1)?.message).toContain('Could not allocate scratch registers');
  });

  it('covers route-transfer local hop and mocked incoming-direction failure', async () => {
    const local = buildRouteTransferCycles(
      { row: 1, col: 1 },
      { row: 1, col: 1 },
      'R0',
      'R1',
      0,
      { rows: 4, cols: 4, topology: 'torus', wrapPolicy: 'wrap' } as any,
      span,
      []
    );
    expect(local).toHaveLength(1);
    expect((local[0].statements[0] as any).instruction.text).toContain('SADD R1, R0, ZERO');

    vi.doMock('../packages/compiler-api/src/passes-shared/grid-utils.js', async () => {
      const actual = await vi.importActual<any>('../packages/compiler-api/src/passes-shared/grid-utils.js');
      return {
        ...actual,
        computeRoutePath: () => [{ row: 0, col: 0 }, { row: 0, col: 1 }],
        getIncomingRegister: () => null
      };
    });
    const mod = await import('../packages/compiler-api/src/passes-shared/route-transfer.js');
    const diagnostics: Diagnostic[] = [];
    const broken = mod.buildRouteTransferCycles(
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      'R0',
      'R1',
      0,
      { rows: 4, cols: 4, topology: 'mesh', wrapPolicy: 'clamp' } as any,
      span,
      diagnostics
    );
    expect(broken).toHaveLength(1);
    expect(diagnostics.at(-1)?.code).toBe(ErrorCodes.Internal.UnexpectedState);
  });

  it('covers control-handler for unterminated for/while and else-next-line parse path', () => {
    const diagnostics: Diagnostic[] = [];
    const parseNested = () => [];

    const unterminatedFor = tryParseControlStatement(
      [entry(1, 'for i in range(0, 2) {')],
      0,
      'for i in range(0, 2) {',
      1,
      { value: 0 },
      diagnostics,
      parseNested
    );
    expect(unterminatedFor.stop).toBe(true);

    const ifEntries = [
      entry(1, 'if (R0 == IMM(0)) at @x,y {'),
      entry(2, 'bundle { @0,0: NOP; }'),
      entry(3, '}'),
      entry(4, 'else {'),
      entry(5, 'bundle { @0,1: NOP; }'),
      entry(6, '}')
    ];
    const ifResult = tryParseControlStatement(ifEntries, 0, ifEntries[0].cleanLine, 1, { value: 0 }, diagnostics, parseNested);
    expect(ifResult.handled).toBe(true);
    expect((ifResult.node as any).control).toEqual({ row: 0, col: 0 });
    expect((ifResult.node as any).elseBody).toBeDefined();

    const unterminatedWhile = tryParseControlStatement(
      [entry(1, 'while (R0 < IMM(3)) at @0,0 {')],
      0,
      'while (R0 < IMM(3)) at @0,0 {',
      1,
      { value: 0 },
      diagnostics,
      parseNested
    );
    expect(unterminatedWhile.stop).toBe(true);
  });

  it('covers function-expand if/while unterminated and else-break paths', () => {
    const diagnostics: Diagnostic[] = [];
    const k = kernel();

    const ifUnterminated = tryExpandIfStatement({
      body: [entry(1, 'if (R0 == IMM(0)) at @0,0 {')],
      index: 0,
      entry: entry(1, 'if (R0 == IMM(0)) at @0,0 {'),
      clean: 'if (R0 == IMM(0)) at @0,0 {',
      kernel: k as any,
      functions: new Map(),
      constants: new Map(),
      diagnostics,
      cycleCounter: { value: 0 },
      callStack: [],
      expansionCounter: { value: 0 },
      controlFlowCounter: { value: 0 },
      expandBody: () => {}
    } as any);
    expect(ifUnterminated.shouldBreak).toBe(true);

    const ifElseBroken = tryExpandIfStatement({
      body: [
        entry(1, 'if (R0 == IMM(0)) at @0,0 {'),
        entry(2, 'bundle { @0,0: NOP; }'),
        entry(3, '} else {'),
        entry(4, 'bundle { @0,1: NOP; }')
      ],
      index: 0,
      entry: entry(1, 'if (R0 == IMM(0)) at @0,0 {'),
      clean: 'if (R0 == IMM(0)) at @0,0 {',
      kernel: kernel() as any,
      functions: new Map(),
      constants: new Map(),
      diagnostics,
      cycleCounter: { value: 0 },
      callStack: [],
      expansionCounter: { value: 0 },
      controlFlowCounter: { value: 0 },
      expandBody: () => {}
    } as any);
    expect(ifElseBroken.shouldBreak).toBe(true);

    const whileUnterminated = tryExpandWhileStatement({
      body: [entry(1, 'while (R0 < IMM(3)) at @0,0 {')],
      index: 0,
      entry: entry(1, 'while (R0 < IMM(3)) at @0,0 {'),
      clean: 'while (R0 < IMM(3)) at @0,0 {',
      kernel: kernel() as any,
      functions: new Map(),
      constants: new Map(),
      diagnostics,
      cycleCounter: { value: 0 },
      callStack: [],
      expansionCounter: { value: 0 },
      controlFlowCounter: { value: 0 },
      expandBody: () => {}
    } as any);
    expect(whileUnterminated.shouldBreak).toBe(true);
  });

  it('covers expandFunctionBody unsupported statement diagnostic', () => {
    const diagnostics: Diagnostic[] = [];
    const k = kernel();
    expandFunctionBodyIntoKernel(
      [entry(1, '???')],
      k as any,
      new Map(),
      new Map(),
      diagnostics,
      { value: 0 },
      [],
      { value: 0 },
      { value: 0 }
    );
    expect(diagnostics.at(-1)?.message).toContain('Unsupported function body statement');
  });

  it('covers cycle-loop fallback by mocking all steps as unhandled', async () => {
    vi.doMock('../packages/compiler-front/src/structured-core/lowering/cycle-loop/steps.js', () => ({
      tryExpandNestedForLoopStep: () => ({ handled: false, statements: [], shouldBreak: false, nextIndex: 0 }),
      tryExpandSpatialAtBlockStep: () => ({ handled: false, statements: [], shouldBreak: false, nextIndex: 0 }),
      tryExpandSingleCycleStatementStep: () => ({ handled: false, statements: [], shouldBreak: false, nextIndex: 0 })
    }));
    const { expandLoopBody } = await import('../packages/compiler-front/src/structured-core/lowering/cycle-loop.js');
    const out = expandLoopBody(
      [entry(1, 'cycle ???')],
      new Map(),
      new Map(),
      []
    );
    expect(out).toEqual([]);
  });

  it('covers while-cycles non-fused back-edge emission', () => {
    const k = kernel();
    const next = emitWhileControlFlowCycles({
      kernel: k as any,
      cycleIndex: 0,
      lineNo: 1,
      row: 0,
      col: 0,
      condition: { lhs: 'R0', operator: '!=', rhs: 'ZERO' },
      startLabel: 'L_START',
      endLabel: 'L_END',
      loopCycles: [],
      fusionPlan: null
    } as any);
    expect(next).toBe(3);
    expect(k.cycles.some((cycle: any) => (cycle.statements[0] as any).instruction.text.includes('JUMP ZERO, L_START'))).toBe(true);
  });

  it('covers compile-driver analysisAst fallback and instructions=0 path with mocks', async () => {
    const ast: any = {
      targetProfileId: 'uma-cgra-base',
      span,
      kernel: { name: 'k', config: undefined, directives: [], pragmas: [], cycles: [], span }
    };
    vi.doMock('../packages/compiler-api/src/compiler-driver/parse-driver.js', () => ({
      parse: () => ({ success: true, diagnostics: [], ast, structuredAst: undefined })
    }));
    vi.doMock('../packages/compiler-api/src/compiler-driver/analyze-driver.js', () => ({
      analyze: () => ({
        diagnostics: [],
        ast,
        hir: undefined,
        mir: undefined,
        lir: undefined,
        memoryRegions: [],
        ioConfig: { loadAddrs: [], storeAddrs: [] },
        assertions: [],
        symbols: { constants: {}, aliases: {}, labels: {} },
        loweredPasses: []
      })
    }));
    vi.doMock('../packages/compiler-api/src/compiler-driver/emit-driver.js', () => ({
      emit: () => ({ csv: 'cycle,row,col,instruction\n', diagnostics: [] })
    }));

    const { compile } = await import('../packages/compiler-api/src/compiler-driver/compile-driver.js');
    const result = compile('kernel "k" {}');
    expect(result.stats.instructions).toBe(0);
    expect(result.artifacts.ast).toBeDefined();
  });

  it('covers grid-resolver unknown target profile branch', () => {
    const diagnostics: Diagnostic[] = [];
    const resolved = resolveGrid(
      { targetProfileId: 'unknown-target', target: { id: 'unknown-target', raw: 'unknown-target', span }, kernel: null, span } as any,
      diagnostics
    );
    expect(resolved).toBeNull();
    expect(diagnostics.at(-1)?.code).toBe(ErrorCodes.Semantic.UnknownTargetProfile);
  });

});
