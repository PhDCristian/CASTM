import { afterEach, describe, expect, it, vi } from 'vitest';
import { Diagnostic, ErrorCodes, spanAt } from '@castm/compiler-ir';
import { buildStencilCycles } from '../packages/compiler-api/src/passes-shared/collective/stencil.js';
import { parseBroadcastPragmaArgs } from '../packages/compiler-api/src/passes-shared/advanced-args/broadcast.js';
import { parseProgramHeadersFromTokens } from '../packages/compiler-front/src/structured-core/token-stream.js';

const span = spanAt(1, 1, 1);

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
  vi.clearAllMocks();
});

describe('branch coverage round 5', () => {
  it('covers stencil lowering branches for empty/horizontal/vertical', () => {
    expect(buildStencilCycles(
      { pattern: 'cross', operation: 'add', srcReg: 'R0', destReg: 'R1' },
      0,
      { rows: 4, cols: 0, topology: 'mesh', wrapPolicy: 'clamp' } as any,
      span,
      []
    )).toEqual([]);

    const horizontal = buildStencilCycles(
      { pattern: 'horizontal', operation: 'sum', srcReg: 'R0', destReg: 'R1' },
      1,
      { rows: 2, cols: 2, topology: 'torus', wrapPolicy: 'wrap' } as any,
      span,
      []
    );
    expect(horizontal).toHaveLength(2);

    const vertical = buildStencilCycles(
      { pattern: 'vertical', operation: 'avg', srcReg: 'R0', destReg: 'R1' },
      3,
      { rows: 2, cols: 2, topology: 'torus', wrapPolicy: 'wrap' } as any,
      span,
      []
    );
    expect(vertical).toHaveLength(2);
  });

  it('covers transpose and gather scratch-allocation failures via mocks', async () => {
    vi.doMock('../packages/compiler-api/src/passes-shared/collective-scan-reduce.js', async () => {
      const actual = await vi.importActual<any>('../packages/compiler-api/src/passes-shared/collective-scan-reduce.js');
      return {
        ...actual,
        pickScratchRegisters: () => null
      };
    });

    const transpose = await import('../packages/compiler-api/src/passes-shared/collective/transpose.js');
    const gather = await import('../packages/compiler-api/src/passes-shared/collective/gather-stream/gather.js');

    const tDiagnostics: Diagnostic[] = [];
    const tCycles = transpose.buildTransposeCycles(
      { reg: 'R0' },
      0,
      { rows: 4, cols: 4, topology: 'torus', wrapPolicy: 'wrap' } as any,
      span,
      tDiagnostics
    );
    expect(tCycles).toEqual([]);
    expect(tDiagnostics.at(-1)?.message).toContain('Could not allocate scratch registers');

    const gDiagnostics: Diagnostic[] = [];
    const gCycles = gather.buildGatherCycles(
      { srcReg: 'R0', destReg: 'R1', dest: { row: 0, col: 0 }, operation: 'add' },
      0,
      { rows: 4, cols: 4, topology: 'torus', wrapPolicy: 'wrap' } as any,
      span,
      gDiagnostics
    );
    expect(gCycles).toEqual([]);
    expect(gDiagnostics.at(-1)?.message).toContain('Could not allocate scratch registers');
  });

  it('covers route build local and mocked unknown-incoming branches', async () => {
    const routeMod = await import('../packages/compiler-api/src/passes-shared/route-builders/build-route.js');
    const local = routeMod.buildRouteCycles(
      { src: { row: 0, col: 0 }, dst: { row: 0, col: 0 }, payload: 'R0', accum: 'R1' },
      0,
      { rows: 4, cols: 4, topology: 'torus', wrapPolicy: 'wrap' } as any,
      span,
      []
    );
    expect(local).toHaveLength(1);

    vi.resetModules();
    vi.doMock('../packages/compiler-api/src/passes-shared/grid-utils.js', async () => {
      const actual = await vi.importActual<any>('../packages/compiler-api/src/passes-shared/grid-utils.js');
      return {
        ...actual,
        computeRoutePath: () => [{ row: 0, col: 0 }, { row: 0, col: 1 }],
        getIncomingRegister: () => null
      };
    });
    const mocked = await import('../packages/compiler-api/src/passes-shared/route-builders/build-route.js');
    const diagnostics: Diagnostic[] = [];
    const cycles = mocked.buildRouteCycles(
      { src: { row: 0, col: 0 }, dst: { row: 0, col: 1 }, payload: 'R0', accum: 'R1' },
      0,
      { rows: 4, cols: 4, topology: 'mesh', wrapPolicy: 'clamp' } as any,
      span,
      diagnostics
    );
    expect(cycles.length).toBeGreaterThanOrEqual(1);
    expect(diagnostics.at(-1)?.code).toBe(ErrorCodes.Internal.UnexpectedState);
  });

  it('covers desugar passes branches via mocked helpers', async () => {
    const ast: any = {
      targetProfileId: 'uma-cgra-base',
      span,
      kernel: {
        name: 'k',
        config: undefined,
        directives: [],
        pragmas: [],
        cycles: [{
          index: 0,
          span,
          statements: [{
            kind: 'at',
            row: 0,
            col: 0,
            instruction: { text: 'LWI R1, A[0]', opcode: 'LWI', operands: ['R1', 'A[0]'], span },
            span
          }]
        }],
        span
      }
    };
    const memoryMod = await import('../packages/compiler-api/src/passes-shared/desugar/memory-pass.js');
    const memoryResult = memoryMod.createDesugarMemoryPass(new Map([['A', { start: 100, length: 4 }]])).run(ast);
    const memInst = (memoryResult.output.kernel.cycles[0].statements[0] as any).instruction;
    expect(memInst.text).toBe('LWI R1, 100');

    vi.doMock('../packages/compiler-api/src/passes-shared/desugar-utils.js', async () => {
      const actual = await vi.importActual<any>('../packages/compiler-api/src/passes-shared/desugar-utils.js');
      return {
        ...actual,
        splitTopLevelBinary: () => ({ left: 'R1', op: '??', right: 'R2' })
      };
    });
    const exprMod = await import('../packages/compiler-api/src/passes-shared/desugar/expressions-pass.js');
    const exprResult = exprMod.desugarExpressionsPass.run({
      targetProfileId: 'uma-cgra-base',
      span,
      kernel: {
        name: 'k',
        config: undefined,
        directives: [],
        pragmas: [],
        cycles: [{
          index: 0,
          span,
          statements: [{
            kind: 'at',
            row: 0,
            col: 0,
            instruction: { text: 'R0 = R1 ?? R2', opcode: '', operands: [], span },
            span
          }]
        }],
        span
      }
    } as any);
    expect(exprResult.diagnostics.at(-1)?.message).toContain("Unsupported operator '??'");
  });

  it('covers broadcast direct parser branch guards', () => {
    expect(parseBroadcastPragmaArgs('broadcast(value=1, from=@0,0, to=row)')).toBeNull();
    expect(parseBroadcastPragmaArgs('broadcast(value=R1, from=@bad, to=row)')).toBeNull();
    expect(parseBroadcastPragmaArgs('broadcast(value=R1, from=@0,0, to=row)')).toMatchObject({
      valueReg: 'R1',
      scope: 'row'
    });
  });

  it('covers token-stream paths without string literals', () => {
    const headers = parseProgramHeadersFromTokens(`
target 123;
kernel not_a_string {
}
`);
    expect(headers.targetProfileId).toBeNull();
    expect(headers.kernelName).toBeNull();
    expect(headers.kernelHeaderLine).toBeNull();
  });

  it('covers cycle-loop spatial handled branch with step mocks', async () => {
    vi.doMock('../packages/compiler-front/src/structured-core/lowering/cycle-loop/steps.js', () => ({
      tryExpandNestedForLoopStep: () => ({ handled: false, statements: [], shouldBreak: false, nextIndex: 0 }),
      tryExpandSpatialAtBlockStep: () => ({
        handled: true,
        statements: [{ kind: 'all', instruction: { text: 'NOP', opcode: 'NOP', operands: [], span }, span }],
        shouldBreak: false,
        nextIndex: 0
      }),
      tryExpandSingleCycleStatementStep: () => ({ handled: false, statements: [], shouldBreak: false, nextIndex: 0 })
    }));
    const { expandLoopBody } = await import('../packages/compiler-front/src/structured-core/lowering/cycle-loop.js');
    const out = expandLoopBody(
      [{ lineNo: 1, rawLine: 'at @0,0 { NOP; }', cleanLine: 'at @0,0 { NOP; }' }],
      new Map(),
      new Map(),
      []
    );
    expect(out).toHaveLength(1);
  });

  it('covers static-for early return when enumerate fails', async () => {
    vi.doMock('../packages/compiler-front/src/structured-core/lowering/for-expand-helpers.js', async () => {
      const actual = await vi.importActual<any>('../packages/compiler-front/src/structured-core/lowering/for-expand-helpers.js');
      return {
        ...actual,
        enumerateForValues: () => null
      };
    });
    const mod = await import('../packages/compiler-front/src/structured-core/lowering/for-expand-static.js');
    const outKernel: any = { name: 'k', config: undefined, directives: [], pragmas: [], cycles: [], span };
    mod.expandStaticForLoop({
      header: { variable: 'i', start: 0, end: 4, step: 1 },
      loopBody: [],
      lineNo: 1,
      lineLength: 10,
      kernel: outKernel,
      functions: new Map(),
      constants: new Map(),
      diagnostics: [],
      cycleCounter: { value: 0 },
      callStack: [],
      expansionCounter: { value: 0 },
      controlFlowCounter: { value: 0 },
      callbacks: {
        cycleHasControlFlow: () => false,
        cloneCycle: (cycle: any) => cycle,
        parseInstruction: () => ({ text: 'NOP', opcode: 'NOP', operands: [], span }),
        makeControlCycle: () => ({ index: 0, span, statements: [] }),
        expandFunctionBodyIntoKernel: () => {}
      }
    } as any);
    expect(outKernel.cycles).toEqual([]);
  });
});
