import { afterEach, describe, expect, it, vi } from 'vitest';
import { AstProgram, spanAt } from '@castm/compiler-ir';
import { parseAssertionDirectiveValue } from '../packages/compiler-api/src/compiler-driver/assertions.js';
import { collectDirectiveArtifacts } from '../packages/compiler-api/src/compiler-driver/runtime-artifacts/directives.js';
import { collectArrayAndLabelSymbols, createEmptySymbolCollections } from '../packages/compiler-api/src/compiler-driver/runtime-artifacts/symbols.js';
import { cloneAst } from '../packages/compiler-api/src/passes-shared/ast-utils.js';
import { parseIntegerLiteral, parseKeyValueArgs } from '../packages/compiler-api/src/passes-shared/pragma-args-utils.js';
import { parseRoutePragmaArgs } from '../packages/compiler-api/src/passes-shared/route-args.js';
import {
  parseAllreducePragmaArgs,
  parseBroadcastPragmaArgs,
  parseGatherPragmaArgs,
  parseReducePragmaArgs,
  parseScanPragmaArgs,
  parseStencilPragmaArgs,
  parseStreamLoadPragmaArgs,
  parseStreamStorePragmaArgs,
  parseTransposePragmaArgs
} from '../packages/compiler-api/src/passes-shared/advanced-args.js';
import {
  buildGatherCycles,
  buildReduceCycles,
  buildScanCycles,
  buildStreamCycles
} from '../packages/compiler-api/src/passes-shared/collective-builders.js';
import { createDesugarMemoryPass } from '../packages/compiler-api/src/passes-shared/desugar/memory-pass.js';
import { splitAssignment, splitTopLevelBinary } from '../packages/compiler-api/src/passes-shared/desugar-utils/expressions.js';
import { lowerCycleStatements } from '../packages/compiler-api/src/passes-shared/lowering/resolve-symbols/cycle-lowering.js';
import { resolveLabelOperand } from '../packages/compiler-api/src/passes-shared/lowering/resolve-symbols/labels.js';
import { createResolveSymbolsPass } from '../packages/compiler-api/src/passes-shared/lowering/resolve-symbols/pass.js';
import { buildRotateShiftCycles } from '../packages/compiler-api/src/passes-shared/route-builders.js';
import { parseStructuredProgramFromSource } from '../packages/compiler-front/src/structured-core/parse-source.js';
import { parseStructuredStatements } from '../packages/compiler-front/src/structured-core/statements.js';
import { parseProgramHeadersFromTokens } from '../packages/compiler-front/src/structured-core/token-stream.js';
import { parseControlHeader } from '../packages/compiler-front/src/structured-core/lowering/control-flow-branch.js';
import { parseForHeader } from '../packages/compiler-front/src/structured-core/lowering/control-flow-for.js';
import {
  buildRuntimeNoUnrollAggressivePlan,
  chooseJumpColumn
} from '../packages/compiler-front/src/structured-core/lowering/for-expand-helpers/runtime-plan.js';
import { buildWhileFusionPlan } from '../packages/compiler-front/src/structured-core/lowering/function-expand-helpers/while-fusion.js';
import { resolveOptionalElseBlockInFunction } from '../packages/compiler-front/src/structured-core/lowering/function-expand-if/else-resolution.js';
import { bindFunctionCallArgs } from '../packages/compiler-front/src/structured-core/lowering/functions/bind.js';
import { evaluateNumericExpression } from '../packages/compiler-front/src/structured-core/parser-utils/numbers.js';
import { parseFunctionCall } from '../packages/compiler-front/src/structured-core/statements/matchers.js';

const span = spanAt(1, 1, 1);

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
  vi.clearAllMocks();
});

function makeAst(): AstProgram {
  return {
    targetProfileId: 'uma-cgra-base',
    span,
    kernel: {
      name: 'k',
      config: undefined,
      directives: [],
      pragmas: [],
      cycles: [],
      span
    }
  };
}

describe('branch coverage round 10 - compiler api', () => {
  it('covers assertion fallback branches and object payload miss', () => {
    const noKernelAst = { targetProfileId: 'uma-cgra-base', kernel: null, span } as AstProgram;
    const parsedNoKernel = parseAssertionDirectiveValue(noKernelAst, span, 'assert(at=@0,0, reg=R1, equals=1)');
    expect('cycle' in parsedNoKernel && parsedNoKernel.cycle).toBe(0);

    const ast = makeAst();
    ast.kernel!.cycles = [
      { index: 1, span: spanAt(10, 1, 1), statements: [] },
      { index: 3, span: spanAt(20, 1, 1), statements: [] }
    ];
    const parsed = parseAssertionDirectiveValue(ast, spanAt(30, 1, 1), 'assert(at=@0,0, reg=R1, equals=1)');
    expect('cycle' in parsed && parsed.cycle).toBe(3);

    const invalidObject = parseAssertionDirectiveValue(ast, span, 'assert(location=0,0, reg=R1)');
    expect('message' in invalidObject).toBe(true);
  });

  it('covers optional kernel branches in runtime directives/symbols and config clone branch', () => {
    const diagnostics: any[] = [];
    const runtime = collectDirectiveArtifacts(
      { targetProfileId: 'uma-cgra-base', kernel: null, span } as AstProgram,
      diagnostics,
      createEmptySymbolCollections()
    );
    expect(runtime.assertions).toEqual([]);

    const symbols = collectArrayAndLabelSymbols({ targetProfileId: 'uma-cgra-base', kernel: null, span } as AstProgram, []);
    expect(symbols.labels).toEqual({});

    const ast = makeAst();
    ast.kernel!.config = { mask: 1, startAddr: 2, span };
    expect(cloneAst(ast).kernel?.config?.mask).toBe(1);
  });

  it('covers parseData explicit-start null branch via parseNumericLiteral mock', async () => {
    vi.doMock('../packages/compiler-api/src/compiler-driver/numbers.js', async () => {
      const actual = await vi.importActual<any>('../packages/compiler-api/src/compiler-driver/numbers.js');
      return {
        ...actual,
        parseNumericLiteral: () => null
      };
    });
    const parseMod = await import('../packages/compiler-api/src/compiler-driver/data-regions/parse.js');
    expect(parseMod.parseDataDirectiveValue('10 {1,2}')).toBeNull();
  });

  it('covers scan/reduce/gather/parser helper missed branches', () => {
    expect(parseIntegerLiteral('-0xF')).toBe(-15);
    expect(parseKeyValueArgs('a=1,,b=2')).toBeNull();

    expect(parseRoutePragmaArgs('route(@0,0 -> @0,x, payload=R0, accum=R1)')).toBeNull();
    expect(parseRoutePragmaArgs('route(@0,0 -> @0,1, payload=R0,, accum=R1)')).toBeNull();
    expect(parseRoutePragmaArgs('route(@0,0 -> @0,1, payload=R0, dest=R1, op=ADD( ,R2,R3))')).toBeNull();

    expect(parseBroadcastPragmaArgs('broadcast(value=R1, from=@0,x, to=row)')).toBeNull();
    expect(parseBroadcastPragmaArgs('broadcast(value=R1, from=@0,0)')).toBeNull();
    expect(parseBroadcastPragmaArgs('broadcast(value=1, from=@0,0, to=diag)')).toBeNull();

    expect(parseStencilPragmaArgs('bad')).toBeNull();
    expect(parseStencilPragmaArgs('stencil(cross, add, R0, R1)')).toMatchObject({ srcReg: 'R0', destReg: 'R1' });

    expect(parseTransposePragmaArgs('bad')).toBeNull();

    expect(parseGatherPragmaArgs('gather(src=R0,dest=@0,x,destreg=R1,op=add)')).toBeNull();
    expect(parseGatherPragmaArgs('bad')).toBeNull();
    expect(parseGatherPragmaArgs('gather(src=R0,dest=@0,0)')).toBeNull();
    expect(parseGatherPragmaArgs('gather(src=R0,dest=@0,0,destreg=R1,op=1)')).toBeNull();

    expect(parseScanPragmaArgs('scan(op=add, src=R0, dest=R1)')).toBeNull();
    expect(parseReducePragmaArgs('bad')).toBeNull();
    expect(parseReducePragmaArgs('reduce(op=add,dest=R1,src=R0,bad=1)')).toBeNull();
    expect(parseReducePragmaArgs('reduce(op=add,dest=R1)')).toBeNull();
    expect(parseReducePragmaArgs('reduce(op=add,dest=R1,src=R0)')).toMatchObject({ axis: 'row' });
    expect(parseAllreducePragmaArgs('bad')).toBeNull();
    expect(parseAllreducePragmaArgs('allreduce(op=add,dest=R1,src=R0,bad=1)')).toBeNull();
    expect(parseAllreducePragmaArgs('allreduce(op=add,dest=R1)')).toBeNull();

    expect(parseStreamLoadPragmaArgs('stream_load(dest=R0,,row=1)')).toBeNull();
    expect(parseStreamStorePragmaArgs('stream_store(src=R0,,row=1)')).toBeNull();
  });

  it('covers collective builder branch leftovers', () => {
    const grid = { rows: 3, cols: 3, topology: 'torus', wrapPolicy: 'wrap' } as const;
    expect(buildGatherCycles(
      { srcReg: 'R0', dest: { row: 0, col: 0 }, destReg: 'R1', operation: 'sum' },
      0,
      { rows: 1, cols: 1, topology: 'torus', wrapPolicy: 'wrap' },
      span,
      []
    ).length).toBe(1);

    const absSpy = vi.spyOn(Math, 'abs').mockImplementation(() => 1);
    const reduced = buildReduceCycles(
      { operation: 'min', destReg: 'R1', srcReg: 'R0', axis: 'col' },
      0,
      { rows: 4, cols: 1, topology: 'torus', wrapPolicy: 'wrap' },
      span,
      []
    );
    expect(reduced.length).toBeGreaterThan(0);
    absSpy.mockRestore();

    const scanMax = buildScanCycles(
      { operation: 'max', srcReg: 'R0', dstReg: 'R1', direction: 'left', mode: 'inclusive' },
      0,
      grid,
      span,
      []
    );
    expect(scanMax.length).toBeGreaterThan(0);

    expect(buildStreamCycles('LWD', 'R0', 0, 0, 0, { rows: 2, cols: 2, topology: 'mesh', wrapPolicy: 'clamp' }, span, []).length).toBe(0);

    const unknownMemory = createDesugarMemoryPass(new Map()).run({
      ...makeAst(),
      kernel: {
        ...makeAst().kernel!,
        cycles: [{
          index: 0,
          span,
          statements: [{
            kind: 'at',
            row: 0,
            col: 0,
            instruction: { text: 'LWI R0, A[i]', opcode: 'LWI', operands: ['R0', 'A[i]'], span },
            span
          }]
        }]
      }
    });
    expect(unknownMemory.diagnostics.length).toBeGreaterThan(0);
  });

  it('covers desugar utils and resolve-symbols branches', () => {
    expect(splitAssignment('=R0')).toEqual({ lhs: '', rhs: 'R0' });
    expect(splitAssignment('R0=')).toEqual({ lhs: 'R0', rhs: '' });
    expect(splitTopLevelBinary('A[i] + B[j]')?.op).toBe('+');

    const lowered = lowerCycleStatements(0, [{
      kind: 'row',
      row: 0,
      instructions: [],
      span
    }] as any, { rows: 2, cols: 2, topology: 'mesh', wrapPolicy: 'clamp' }, new Map(), []);
    expect(lowered).toEqual([]);

    expect(resolveLabelOperand('BEQ', ['R0', 'R1', '5'], new Map(), span, [])).toEqual(['R0', 'R1', '5']);

    const pass = createResolveSymbolsPass('uma-cgra-base', { rows: 2, cols: 2, topology: 'mesh', wrapPolicy: 'clamp' });
    let cycleReads = 0;
    const kernel: any = {
      name: 'k',
      span,
      directives: [],
      pragmas: []
    };
    Object.defineProperty(kernel, 'cycles', {
      get() {
        cycleReads += 1;
        return cycleReads === 1 ? undefined : [];
      }
    });
    const weirdAst = {
      targetProfileId: 'uma-cgra-base',
      span,
      kernel
    } as any;
    expect(pass.run(weirdAst).output.cycles).toEqual([]);
  });

  it('covers route rotate-shift left-direction branch', () => {
    const cycles = buildRotateShiftCycles(
      { reg: 'R0', direction: 'left', distance: 1 },
      true,
      0,
      { rows: 1, cols: 3, topology: 'mesh', wrapPolicy: 'clamp' },
      span,
      []
    );
    expect(cycles.length).toBeGreaterThan(0);
  });
});

describe('branch coverage round 10 - compiler front', () => {
  it('covers parse-source span fallback and token cursor null peek', () => {
    const fakeSource = { split: () => [] } as any;
    const parsed = parseStructuredProgramFromSource(fakeSource);
    expect(parsed.program.span.endColumn).toBe(1);

    const headers = parseProgramHeadersFromTokens('target');
    expect(headers.targetProfileId).toBeNull();
  });

  it('covers control statement stop branch in parseStructuredStatements', () => {
    const entries = [{ lineNo: 1, rawLine: 'if (R0 == IMM(0)) at @0,0 {', cleanLine: 'if (R0 == IMM(0)) at @0,0 {' }];
    const out = parseStructuredStatements(entries as any, { value: 0 }, []);
    expect(out.length).toBe(0);
  });

  it('covers control-flow parser specific branches', () => {
    const diagnostics: any[] = [];
    expect(parseControlHeader('if ((R0) == IMM(1)) at @0,0 {', 'if', 1, new Map(), diagnostics)).toBeTruthy();

    const parsed = parseForHeader('for i in range(0,2) at @x,y {', 1, new Map(), new Map(), diagnostics);
    expect(parsed).toBeNull();
    expect(diagnostics.some((d) => d.message.includes('Invalid control location'))).toBe(true);
  });

  it('covers cycle-loop break branches through mocked step handlers', async () => {
    vi.doMock('../packages/compiler-front/src/structured-core/lowering/cycle-loop/steps.js', async () => {
      const actual = await vi.importActual<any>('../packages/compiler-front/src/structured-core/lowering/cycle-loop/steps.js');
      return {
        ...actual,
        tryExpandNestedForLoopStep: () => ({ handled: true, shouldBreak: true, nextIndex: 0, statements: [] })
      };
    });
    const mod1 = await import('../packages/compiler-front/src/structured-core/lowering/cycle-loop.js');
    expect(mod1.expandLoopBody([{ lineNo: 1, rawLine: 'x', cleanLine: 'x' }], new Map(), new Map(), [])).toEqual([]);

    vi.resetModules();
    vi.doMock('../packages/compiler-front/src/structured-core/lowering/cycle-loop/steps.js', async () => {
      const actual = await vi.importActual<any>('../packages/compiler-front/src/structured-core/lowering/cycle-loop/steps.js');
      return {
        ...actual,
        tryExpandNestedForLoopStep: () => ({ handled: false, shouldBreak: false, nextIndex: 0, statements: [] }),
        tryExpandSpatialAtBlockStep: () => ({ handled: true, shouldBreak: true, nextIndex: 0, statements: [] })
      };
    });
    const mod2 = await import('../packages/compiler-front/src/structured-core/lowering/cycle-loop.js');
    expect(mod2.expandLoopBody([{ lineNo: 1, rawLine: 'x', cleanLine: 'x' }], new Map(), new Map(), [])).toEqual([]);

    vi.resetModules();
    vi.doMock('../packages/compiler-front/src/structured-core/lowering/cycle-loop/steps.js', async () => {
      const actual = await vi.importActual<any>('../packages/compiler-front/src/structured-core/lowering/cycle-loop/steps.js');
      return {
        ...actual,
        tryExpandNestedForLoopStep: () => ({ handled: false, shouldBreak: false, nextIndex: 0, statements: [] }),
        tryExpandSpatialAtBlockStep: () => ({ handled: false, shouldBreak: false, nextIndex: 0, statements: [] }),
        tryExpandSingleCycleStatementStep: () => ({ handled: true, shouldBreak: true, nextIndex: 0, statements: [] })
      };
    });
    const mod3 = await import('../packages/compiler-front/src/structured-core/lowering/cycle-loop.js');
    expect(mod3.expandLoopBody([{ lineNo: 1, rawLine: 'x', cleanLine: 'x' }], new Map(), new Map(), [])).toEqual([]);
  });

  it('covers runtime-plan guard branches and chooseJumpColumn fallback edge', () => {
    const parseInst = (text: string) => ({ text, opcode: text.split(' ')[0], operands: [], span } as any);
    const cycleAt = {
      index: 0,
      label: undefined,
      span,
      statements: [{ kind: 'at', row: 0, col: 3, instruction: parseInst('SADD R1, R0, IMM(1)'), span }]
    };

    const validPlan = buildRuntimeNoUnrollAggressivePlan([cycleAt as any], 'R0', 0, 0, () => false, parseInst);
    expect(validPlan?.incomingRegister).toBe('RCR');

    expect(buildRuntimeNoUnrollAggressivePlan([
      { ...cycleAt, statements: [{ kind: 'row', row: 0, instructions: [], span }] }
    ] as any, 'R0', 0, 0, () => false, parseInst)).toBeNull();
    expect(buildRuntimeNoUnrollAggressivePlan([
      { ...cycleAt, statements: [{ ...cycleAt.statements[0], row: 1 }] }
    ] as any, 'R0', 0, 0, () => false, parseInst)).toBeNull();
    expect(buildRuntimeNoUnrollAggressivePlan([
      { ...cycleAt, statements: [{ ...cycleAt.statements[0], col: 0 }] }
    ] as any, 'R0', 0, 0, () => false, parseInst)).toBeNull();
    expect(buildRuntimeNoUnrollAggressivePlan([
      { ...cycleAt, statements: [{ ...cycleAt.statements[0], instruction: parseInst('NOP') }] }
    ] as any, 'R0', 0, 0, () => false, parseInst)).toBeNull();

    expect(Number.isNaN(chooseJumpColumn(Infinity))).toBe(true);
  });

  it('covers while-fusion and else-resolution branches', () => {
    const parseInst = (text: string) => ({ text, opcode: text.split(' ')[0], operands: [], span } as any);
    const cycleAt: any = {
      index: 0,
      label: undefined,
      span,
      statements: [{ kind: 'at', row: 0, col: 3, instruction: parseInst('SADD R1, R1, R0'), span }]
    };
    expect(buildWhileFusionPlan([cycleAt], 0, 0)?.incomingRegister).toBe('RCL');

    const controlCycle: any = {
      ...cycleAt,
      statements: [{ kind: 'at', row: 0, col: 1, instruction: parseInst('BEQ R1, R0, L'), span }]
    };
    expect(buildWhileFusionPlan([controlCycle], 0, 0)).toBeNull();
    expect(buildWhileFusionPlan([{ ...cycleAt, statements: [{ kind: 'row', row: 0, instructions: [], span }] }], 0, 0)).toBeNull();

    const diagnostics: any[] = [];
    const nullEnd = resolveOptionalElseBlockInFunction([], { body: [], endIndex: null }, 1, 1, diagnostics);
    expect(nullEnd.consumedEnd).toBe(0);

    const trailingEntries: any[] = [
      { lineNo: 1, rawLine: 'if (...) {', cleanLine: 'if (...) {' },
      { lineNo: 2, rawLine: '}', cleanLine: '}' },
      { lineNo: 3, rawLine: 'x', cleanLine: 'x' },
      { lineNo: 4, rawLine: '}', cleanLine: '}' }
    ];
    const resolved = resolveOptionalElseBlockInFunction(
      trailingEntries,
      { body: [], endIndex: 1, trailingAfterClose: 'else {' },
      1,
      10,
      diagnostics
    );
    expect(resolved.shouldBreak).toBe(false);
  });

  it('covers bind usage preview + parser utils/matcher leftovers', () => {
    const diagnostics: any[] = [];
    expect(bindFunctionCallArgs({ name: 'f', params: ['a', 'b'] }, ['a: 1', '2'], 1, diagnostics)).toBeNull();
    expect(diagnostics.some((d) => d.hint?.includes('f(a, b: value)'))).toBe(true);

    expect(evaluateNumericExpression('1 + @2', new Map(), new Map())).toBeNull();
    expect(parseFunctionCall('foo(a, b)')?.args).toEqual(['a', 'b']);
  });
});
