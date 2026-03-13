import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AstProgram,
  ErrorCodes,
  spanAt
} from '@castm/compiler-ir';
import { parseNumericLiteral, parseNumericList } from '../packages/compiler-api/src/compiler-driver/numbers.js';
import { collectDataRegions } from '../packages/compiler-api/src/compiler-driver/data-regions/collect.js';
import {
  parseData2dDirectiveValue,
  parseDataDirectiveValue
} from '../packages/compiler-api/src/compiler-driver/data-regions/parse.js';
import { collectDirectiveArtifacts } from '../packages/compiler-api/src/compiler-driver/runtime-artifacts/directives.js';
import {
  collectArrayAndLabelSymbols,
  createEmptySymbolCollections
} from '../packages/compiler-api/src/compiler-driver/runtime-artifacts/symbols.js';
import { runSemanticChecker } from '../packages/compiler-api/src/compiler-driver/semantic/checker.js';
import { resolveGrid } from '../packages/compiler-api/src/compiler-driver/grid-resolver.js';
import { parseAssertionDirectiveValue } from '../packages/compiler-api/src/compiler-driver/assertions.js';
import {
  cloneAst,
  createInstruction
} from '../packages/compiler-api/src/passes-shared/ast-utils.js';
import {
  computeRoutePath,
  getIncomingRegister,
  isStep
} from '../packages/compiler-api/src/passes-shared/grid-utils.js';
import {
  extractPragmaName,
  extractStatementBody,
  parseIntegerLiteral,
  parseKeyValueArgs,
  splitPositionalArgs
} from '../packages/compiler-api/src/passes-shared/pragma-args-utils.js';
import {
  parseCoordinateLiteral,
  parseRoutePragmaArgs
} from '../packages/compiler-api/src/passes-shared/route-args.js';
import {
  parseBroadcastPragmaArgs,
  parseGatherPragmaArgs,
  parseRotateShiftPragmaArgs,
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
import { buildRotateShiftCycles } from '../packages/compiler-api/src/passes-shared/route-builders.js';
import { desugarExpressionsPass } from '../packages/compiler-api/src/passes-shared/desugar/expressions-pass.js';
import { createDesugarMemoryPass } from '../packages/compiler-api/src/passes-shared/desugar/memory-pass.js';
import {
  splitAssignment,
  splitTopLevelBinary
} from '../packages/compiler-api/src/passes-shared/desugar-utils/expressions.js';
import { parseStructuredSource } from '../packages/compiler-front/src/structured.js';
import { parseStructuredProgramFromSource } from '../packages/compiler-front/src/structured-core/parse-source.js';
import { parseProgramHeadersFromTokens } from '../packages/compiler-front/src/structured-core/token-stream.js';
import { parseStructuredStatements } from '../packages/compiler-front/src/structured-core/statements.js';
import { parseDirective } from '../packages/compiler-front/src/structured-core/lowering/declarations.js';
import { parseCycleStatement } from '../packages/compiler-front/src/structured-core/lowering/statements.js';
import { parseForHeader } from '../packages/compiler-front/src/structured-core/lowering/control-flow-for.js';
import { parseControlHeader } from '../packages/compiler-front/src/structured-core/lowering/control-flow-branch.js';
import { buildWhileFusionPlan } from '../packages/compiler-front/src/structured-core/lowering/function-expand-helpers/while-fusion.js';
import {
  buildRuntimeNoUnrollAggressivePlan,
  chooseJumpColumn
} from '../packages/compiler-front/src/structured-core/lowering/for-expand-helpers/runtime-plan.js';
import { bindFunctionCallArgs } from '../packages/compiler-front/src/structured-core/lowering/functions/bind.js';
import { parseFunctionCallLine } from '../packages/compiler-front/src/structured-core/lowering/functions/call.js';
import {
  applyBindings,
  evaluateCoordinateExpression,
  evaluateNumericExpression,
  parseNumber
} from '../packages/compiler-front/src/structured-core/parser-utils/numbers.js';
import { tryParseCycleStatement } from '../packages/compiler-front/src/structured-core/statements/cycle-handler.js';
import {
  parseFunctionCall,
  shouldSkipStructuredLine
} from '../packages/compiler-front/src/structured-core/statements/matchers.js';

const span = spanAt(1, 1, 1);

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
  vi.clearAllMocks();
});

function makeAst(overrides: Partial<AstProgram> = {}): AstProgram {
  return {
    target: { id: 'uma-cgra-base', raw: 'uma-cgra-base', span },
    targetProfileId: 'uma-cgra-base',
    span,
    kernel: {
      name: 'k',
      config: undefined,
      directives: [],
      runtime: [],
      pragmas: [],
      cycles: [],
      span
    },
    ...overrides
  };
}

describe('branch coverage round 9 - compiler api helpers', () => {
  it('covers numeric parsing branches', () => {
    expect(parseNumericLiteral('-0xA')).toBe(-10);
    expect(parseNumericLiteral('42')).toBe(42);
    expect(parseNumericList('')).toEqual([]);
    expect(parseNumericList('{ 1, x }')).toBeNull();
  });

  it('covers data region parse and collect edge branches', () => {
    expect(parseDataDirectiveValue('foo {1}')).toBeNull();
    expect(parseData2dDirectiveValue('bad')).toBeNull();
    expect(parseData2dDirectiveValue('[0]')).toBeNull();
    expect(parseData2dDirectiveValue('[2][2] {1,2,x,4}')).toBeNull();

    const astNoKernel = { targetProfileId: 'uma-cgra-base', kernel: null, span } as AstProgram;
    const diagnostics: any[] = [];
    const collected = collectDataRegions(astNoKernel, diagnostics);
    expect(collected.regions).toEqual([]);
    expect(collected.symbolsByName.size).toBe(0);
  });

  it('covers runtime directive fallback branches and symbol continues', () => {
    const ast = makeAst();
    ast.kernel!.runtime!.push(
      { kind: 'limit', value: '', raw: 'limit()', span },
      { kind: 'io_load', addresses: ['-1'], raw: 'io.load(-1)', span }
    );
    const diagnostics: any[] = [];
    const symbols = createEmptySymbolCollections();
    const runtime = collectDirectiveArtifacts(ast, diagnostics, symbols);
    expect(runtime.cycleLimit).toBeUndefined();
    expect(diagnostics.some((d: any) => d.code === ErrorCodes.Parse.InvalidSyntax)).toBe(true);

    const symbolCollection = collectArrayAndLabelSymbols(
      {
        ...makeAst(),
        kernel: {
          ...makeAst().kernel!,
          cycles: [{ index: 0, statements: [], span }]
        }
      },
      [{ name: '', start: 0, values: [1] } as any]
    );
    expect(symbolCollection.arrays.length).toBe(0);
    expect(symbolCollection.labels).toEqual({});
  });

  it('covers semantic checker and grid resolver non-torus branch', () => {
    const diagnostics: any[] = [];
    const checked = runSemanticChecker({ targetProfileId: 'uma-cgra-base', kernel: null, span } as AstProgram, diagnostics);
    expect(checked.loweredPasses).toContain('semantic-checker');

    const ast = makeAst();
    ast.build = { grid: { rows: 2, cols: 2, topology: 'mesh' }, span };
    const resolved = resolveGrid(ast, diagnostics);
    expect(resolved?.grid.wrapPolicy).toBe('clamp');
  });

  it('covers assertion default-cycle selection branches', () => {
    const ast: AstProgram = {
      targetProfileId: 'uma-cgra-base',
      span,
      kernel: {
        name: 'k',
        directives: [],
        pragmas: [],
        config: undefined,
        cycles: [
          { index: 9, span: spanAt(10, 1, 1), statements: [] },
          { index: 13, span: spanAt(20, 1, 1), statements: [] }
        ],
        span
      }
    };

    const a = parseAssertionDirectiveValue(ast, spanAt(1, 1, 1), 'assert(at=@0,0, reg=R1, equals=1)');
    expect('cycle' in a && a.cycle).toBe(13);

    const b = parseAssertionDirectiveValue(ast, spanAt(15, 1, 1), 'assert(at=@0,0, reg=R1, equals=1)');
    expect('cycle' in b && b.cycle).toBe(9);
  });

  it('covers ast-utils conditional branches', () => {
    const withoutConfig = makeAst();
    const cloned = cloneAst(withoutConfig);
    expect(cloned.kernel?.config).toBeUndefined();
    expect(createInstruction('nop', [], span).text).toBe('NOP');
  });

  it('covers grid/pragma util branches', () => {
    const grid = { rows: 4, cols: 4, topology: 'mesh', wrapPolicy: 'clamp' } as const;
    const path = computeRoutePath({ row: 3, col: 3 }, { row: 1, col: 1 }, grid);
    expect(path.at(-1)).toEqual({ row: 1, col: 1 });
    expect(isStep({ row: 1, col: 1 }, { row: 1, col: 0 }, 0, -1, grid)).toBe(true);
    expect(getIncomingRegister({ row: 1, col: 1 }, { row: 1, col: 0 }, grid)).toBe('RCR');

    expect(extractPragmaName('???')).toBe('unknown');
    expect(extractStatementBody('route(@0,0->@0,1)', 'scan')).toBeNull();
    expect(parseIntegerLiteral('-0x10')).toBe(-16);
    expect(splitPositionalArgs('a,,b')).toBeNull();
    expect(parseKeyValueArgs('a=1,b')).toBeNull();
  });

  it('covers route parser edge branches', () => {
    expect(parseCoordinateLiteral('')).toBeNull();
    expect(parseCoordinateLiteral('@1 x')).toBeNull();
    expect(parseCoordinateLiteral('@1,')).toBeNull();

    expect(parseRoutePragmaArgs('route(@0,0 -> bad, payload=R0, accum=R1)')).toBeNull();
    expect(parseRoutePragmaArgs('route(@0,0 -> @0,1, payload=R0, dest=R1, op=ADD(R1,R2))')).toBeNull();
    expect(parseRoutePragmaArgs('route(@0,0 -> @0,1, payload=R0, dest=R1, op=ADD( ,R2,R3))')).toBeNull();
    expect(parseRoutePragmaArgs('route(@0,0 -> @0,1, payload=1, accum=R1)')).toBeNull();
    expect(parseRoutePragmaArgs('route(@0,0 -> @0,1, payload=R0, accum=R1, extra=R2)')).toBeNull();
  });

  it('covers advanced args parser branches', () => {
    expect(parseBroadcastPragmaArgs('bad')).toBeNull();
    expect(parseBroadcastPragmaArgs('broadcast(value=R1, from=bad, to=row)')).toBeNull();
    expect(parseBroadcastPragmaArgs('broadcast(value=, from=@0,0, to=row)')).toBeNull();
    expect(parseBroadcastPragmaArgs('broadcast(value=R1, from=@0,0, to=diag)')).toBeNull();

    expect(parseStencilPragmaArgs('stencil(x)')).toBeNull();
    expect(parseStencilPragmaArgs('stencil(diag, add, R0, R1)')).toBeNull();
    expect(parseTransposePragmaArgs('transpose(reg=R0,extra=R1)')).toBeNull();

    expect(parseGatherPragmaArgs('gather(src=R0,dest=bad,destreg=R1,op=add)')).toBeNull();
    expect(parseGatherPragmaArgs('gather(src=R0,dest=@0,0,destreg=R1,op=1)')).toBeNull();
    expect(parseGatherPragmaArgs('gather(src=R0,foo=R1)')).toBeNull();

    expect(parseRotateShiftPragmaArgs('bad', 'rotate')).toBeNull();
    expect(parseRotateShiftPragmaArgs('rotate(reg=R0,direction=left,distance=0)', 'rotate')).toBeNull();
    expect(parseRotateShiftPragmaArgs('shift(reg=R0,direction=right)', 'shift')).toMatchObject({ distance: 1 });

    expect(parseScanPragmaArgs('bad')).toBeNull();
    expect(parseScanPragmaArgs('scan(op=add, src=R0, dest=R1, dir=left, bad=1)')).toBeNull();
    expect(parseScanPragmaArgs('scan(op=add, src=1, dest=R1, dir=left)')).toBeNull();

    expect(parseStreamLoadPragmaArgs('bad')).toBeNull();
    expect(parseStreamLoadPragmaArgs('stream_load(dest=R0,bad=1)')).toBeNull();
    expect(parseStreamLoadPragmaArgs('stream_load(dest=R0,count=a)')).toBeNull();

    expect(parseStreamStorePragmaArgs('bad')).toBeNull();
    expect(parseStreamStorePragmaArgs('stream_store(src=R0,bad=1)')).toBeNull();
    expect(parseStreamStorePragmaArgs('stream_store(src=R0,row=a)')).toBeNull();
  });

  it('covers collective builders and route rotate/shift branches', () => {
    const diagnostics: any[] = [];
    const spanLocal = spanAt(2, 1, 1);

    expect(buildRotateShiftCycles({ reg: 'R0', direction: 'left', distance: 1 }, true, 0, {
      rows: 0,
      cols: 4,
      topology: 'torus',
      wrapPolicy: 'wrap'
    }, spanLocal, diagnostics)).toEqual([]);

    expect(buildRotateShiftCycles({ reg: 'R0', direction: 'left', distance: 1 }, false, 0, {
      rows: 4,
      cols: 4,
      topology: 'mesh',
      wrapPolicy: 'clamp'
    }, spanLocal, diagnostics)).toEqual([]);

    expect(buildRotateShiftCycles({ reg: 'R0', direction: 'left', distance: 4 }, false, 0, {
      rows: 2,
      cols: 4,
      topology: 'torus',
      wrapPolicy: 'wrap'
    }, spanLocal, diagnostics)).toEqual([]);

    const shiftCycles = buildRotateShiftCycles({ reg: 'R0', direction: 'right', distance: 1 }, true, 0, {
      rows: 1,
      cols: 3,
      topology: 'mesh',
      wrapPolicy: 'clamp'
    }, spanLocal, []);
    expect(shiftCycles.length).toBeGreaterThan(0);

    const gatherOps = ['and', 'or', 'xor', 'mul'] as const;
    for (const op of gatherOps) {
      const cycles = buildGatherCycles({ srcReg: 'R0', dest: { row: 0, col: 0 }, destReg: 'R1', operation: op }, 0, {
        rows: 1,
        cols: 1,
        topology: 'torus',
        wrapPolicy: 'wrap'
      }, spanLocal, []);
      expect(cycles.length).toBe(1);
    }

    const gatherTie = buildGatherCycles({ srcReg: 'R0', dest: { row: 1, col: 1 }, destReg: 'R1', operation: 'add' }, 0, {
      rows: 3,
      cols: 3,
      topology: 'torus',
      wrapPolicy: 'wrap'
    }, spanLocal, []);
    expect(gatherTie.length).toBeGreaterThan(1);

    const reduceTieSpy = vi.spyOn(Math, 'abs').mockImplementation(() => 1);
    const reduceCycles = buildReduceCycles({ operation: 'min', destReg: 'R1', srcReg: 'R0', axis: 'row' }, 0, {
      rows: 1,
      cols: 4,
      topology: 'torus',
      wrapPolicy: 'wrap'
    }, spanLocal, []);
    expect(reduceCycles.length).toBeGreaterThan(0);
    reduceTieSpy.mockRestore();

    const scanCycles = buildScanCycles({ operation: 'min', srcReg: 'R0', dstReg: 'R1', direction: 'up', mode: 'exclusive' }, 0, {
      rows: 3,
      cols: 2,
      topology: 'torus',
      wrapPolicy: 'wrap'
    }, spanLocal, []);
    expect(scanCycles.length).toBeGreaterThan(0);

    expect(buildStreamCycles('SWD', 'R0', -1, 1, 0, { rows: 2, cols: 2, topology: 'mesh', wrapPolicy: 'clamp' }, spanLocal, []).length).toBe(0);
    expect(buildStreamCycles('SWD', 'R0', 0, 0, 0, { rows: 2, cols: 2, topology: 'mesh', wrapPolicy: 'clamp' }, spanLocal, []).length).toBe(0);
  });

  it('covers desugar helper/pass edge branches', () => {
    expect(splitAssignment('R0 == R1')).toBeNull();
    expect(splitTopLevelBinary('-R0')).toBeNull();

    const ast = makeAst();
    ast.kernel!.cycles.push({
      index: 0,
      span,
      statements: [
        {
          kind: 'at',
          row: 0,
          col: 0,
          instruction: { text: 'NOP', opcode: '', operands: [], span },
          span
        },
        {
          kind: 'at',
          row: 0,
          col: 1,
          instruction: { text: 'LWI R0, A[i]', opcode: 'LWI', operands: ['R0', 'A[i]'], span },
          span
        },
        {
          kind: 'at',
          row: 0,
          col: 2,
          instruction: { text: 'A[i][j] = R1', opcode: '', operands: [], span },
          span
        },
        {
          kind: 'at',
          row: 0,
          col: 3,
          instruction: { text: 'R1 = A[j][k]', opcode: '', operands: [], span },
          span
        }
      ]
    });

    const memoryPass = createDesugarMemoryPass(new Map([['A', { start: 0, length: 4 }]]));
    const mem = memoryPass.run(ast);
    expect(mem.diagnostics.length).toBeGreaterThan(0);

    const expr = desugarExpressionsPass.run(ast);
    expect(expr.output.kernel?.cycles.length).toBe(1);
  });

  it('covers analyze-driver nullable cycleLimitSpan branch via mock', async () => {
    vi.doMock('../packages/compiler-api/src/compiler-driver/runtime-artifacts.js', async () => {
      const actual = await vi.importActual<any>('../packages/compiler-api/src/compiler-driver/runtime-artifacts.js');
      return {
        ...actual,
        collectRuntimeArtifacts: () => ({
          ioConfig: { loadAddrs: [], storeAddrs: [] },
          cycleLimit: 0,
          cycleLimitSpan: undefined,
          assertions: [],
          symbols: { constants: {}, aliases: {}, arrays: [], labels: {} }
        })
      };
    });
    const { analyze } = await import('../packages/compiler-api/src/compiler-driver/analyze-driver.js');
    const ast = makeAst({
      build: {
        optimize: 'O0',
        scheduler: 'safe',
        schedulerWindow: 0,
        pruneNoopCycles: false,
        span
      },
      kernel: {
        ...makeAst().kernel!,
        cycles: [
          {
            index: 0,
            span,
            statements: [
              {
                kind: 'at',
                row: 0,
                col: 0,
                instruction: createInstruction('NOP', [], span),
                span
              }
            ]
          }
        ]
      }
    });
    const result = analyze(ast);
    expect(result.diagnostics.some((d) => d.message.includes('limit(...)'))).toBe(true);
  });

  it('covers expand-pragmas missing branches with mocked registry sets', async () => {
    vi.doMock('../packages/compiler-api/src/passes-shared/expand-pragmas-handlers.js', () => ({
      NOOP_PRAGMAS: new Set(['noopx']),
      SUPPORTED_PRAGMAS: new Set(['noopx', 'supported_no_handler']),
      PRAGMA_HANDLERS: new Map()
    }));
    const { createExpandPragmasPass } = await import('../packages/compiler-api/src/passes-shared/expand-pragmas-pass.js');

    const noKernelOut = createExpandPragmasPass(true, { rows: 1, cols: 1, topology: 'torus', wrapPolicy: 'wrap' }).run({
      targetProfileId: 'uma-cgra-base',
      span,
      kernel: null
    } as AstProgram);
    expect(noKernelOut.diagnostics).toEqual([]);

    const ast = makeAst();
    ast.kernel!.pragmas.push(
      { text: 'noopx(1)', span },
      { text: 'supported_no_handler(1)', span },
      { text: 'unknown_pragma(1)', span }
    );

    const strictFalse = createExpandPragmasPass(false, { rows: 1, cols: 1, topology: 'torus', wrapPolicy: 'wrap' }).run(ast);
    expect(strictFalse.diagnostics).toEqual([]);

    const strictTrue = createExpandPragmasPass(true, { rows: 1, cols: 1, topology: 'torus', wrapPolicy: 'wrap' }).run(ast);
    expect(strictTrue.diagnostics.some((d) => d.code === ErrorCodes.Semantic.UnsupportedPragma)).toBe(true);
  });

  it('covers rotate/stream handler invalid-shift hint branch', async () => {
    const { handleRotateShift } = await import('../packages/compiler-api/src/passes-shared/expand-pragmas/handlers-rotate-stream.js');
    const diagnostics: any[] = [];
    const ctx = {
      grid: { rows: 2, cols: 2, topology: 'mesh', wrapPolicy: 'clamp' },
      generatedCycles: [],
      diagnostics
    };
    handleRotateShift({ text: 'shift(x)', span } as any, ctx as any);
    expect(diagnostics.at(-1)?.hint).toContain('shift(');
  });
});

describe('branch coverage round 9 - compiler front helpers', () => {
  it('covers structured parse minimum/program span/token stream edges', () => {
    const parsed = parseStructuredSource('target "uma-cgra-base";');
    expect(parsed.success).toBe(false);
    expect(parsed.diagnostics.some((d) => d.code === ErrorCodes.Parse.MissingKernel)).toBe(true);

    const empty = parseStructuredProgramFromSource('');
    expect(empty.program.span.endColumn).toBe(1);

    const headers = parseProgramHeadersFromTokens('target x; kernel "k" { }');
    expect(headers.targetProfileId).toBe('x');
  });

  it('covers statement parser stop branches and matcher guards', () => {
    const diagnostics: any[] = [];
    const entries = [{ lineNo: 1, rawLine: 'bundle {', cleanLine: 'bundle {' }];
    const out = parseStructuredStatements(entries as any, { value: 0 }, diagnostics);
    expect(out.length).toBe(1);

    expect(shouldSkipStructuredLine('assert(at=@0,0, reg=R1, equals=1)')).toBe(true);
    expect(parseFunctionCall('route(a=b)')).toBeNull();
    expect(parseFunctionCall('if(x)')).toBeNull();
  });

  it('covers declarations/cycle statement parser null branches', () => {
    expect(parseDirective('let M[4][4];', 1)?.kind).toBe('data2d');
    expect(parseDirective('let A[4];', 1)?.kind).toBe('data2d');
    expect(parseDirective('let A[4] = {1,2,3,4};', 1)?.kind).toBe('data2d');

    expect(parseCycleStatement('@bad,0: NOP;', 1, '@bad,0: NOP;', new Map(), new Map())).toMatchObject([{
      kind: 'at-expr',
      rowExpr: 'bad',
      colExpr: '0'
    }]);
    expect(parseCycleStatement('@0..,1: NOP;', 1, '@0..,1: NOP;', new Map(), new Map())).toBeNull();
    expect(parseCycleStatement('@bad..1,0: NOP;', 1, '@bad..1,0: NOP;', new Map(), new Map())).toBeNull();
    expect(parseCycleStatement('@a[0]{1}x,(0)..(1): NOP;', 1, '@a[0]{1}x,(0)..(1): NOP;', new Map(), new Map()))
      .toMatchObject([
        { kind: 'at-expr', rowExpr: 'a[0]{1}x', colExpr: '0' },
        { kind: 'at-expr', rowExpr: 'a[0]{1}x', colExpr: '1' }
      ]);
    expect(parseCycleStatement('at row bad: NOP;', 1, 'at row bad: NOP;', new Map(), new Map())).toBeNull();
    expect(parseCycleStatement('at col bad: NOP;', 1, 'at col bad: NOP;', new Map(), new Map())).toBeNull();
  });

  it('covers control-flow parser branches', () => {
    const diagnostics: any[] = [];
    expect(parseControlHeader('if ([R0] < IMM(1)) at @0,0 {', 'if', 1, new Map(), diagnostics)).toBeTruthy();
    expect(parseControlHeader('if (R0 < ) at @0,0 {', 'if', 2, new Map(), diagnostics)).toBeNull();

    expect(parseForHeader('for i in range(0, 2) at @x,y {', 1, new Map(), new Map(), diagnostics)).toBeNull();
    expect(parseForHeader('for i in range(0, 2) runtime {', 2, new Map(), new Map(), diagnostics)).toBeNull();
  });

  it('covers runtime plan/while fusion/front helpers edge branches', () => {
    const parseInst = (text: string) => ({ text, opcode: text.split(' ')[0], operands: [], span } as any);
    const baseCycle: any = {
      index: 0,
      label: undefined,
      span,
      statements: [{ kind: 'at', row: 0, col: 3, instruction: parseInst('SADD R1, R0, IMM(1)'), span }]
    };

    expect(chooseJumpColumn(0, 1)).toBe(2);
    expect(buildRuntimeNoUnrollAggressivePlan([baseCycle], 'R0', 0, 0, () => true, parseInst)).toBeNull();
    expect(buildRuntimeNoUnrollAggressivePlan([{ ...baseCycle, label: 'L' }], 'R0', 0, 0, () => false, parseInst)).toBeNull();
    expect(buildRuntimeNoUnrollAggressivePlan([{ ...baseCycle, statements: [] }], 'R0', 0, 0, () => false, parseInst)).toBeNull();

    expect(buildWhileFusionPlan([{ ...baseCycle, statements: [] }], 0, 0)).toBeNull();
    expect(buildWhileFusionPlan([{ ...baseCycle, statements: [{ ...baseCycle.statements[0], row: 0, col: 0 }] }], 0, 0)).toBeNull();

    const bindDiagnostics: any[] = [];
    expect(bindFunctionCallArgs({ name: 'f', params: ['x'] }, ['y: 1', '2'], 1, bindDiagnostics)).toBeNull();
    expect(bindDiagnostics.length).toBeGreaterThan(0);
    expect(parseFunctionCallLine('noop()')).toEqual({ name: 'noop', args: [] });

    expect(parseNumber('-0xF')).toBe(-15);
    expect(applyBindings('i + j', new Map([['i', 1], ['j', 2]])).includes('1')).toBe(true);
    expect(evaluateNumericExpression('Math.max(1,2)', new Map(), new Map())).toBeNull();
    expect(evaluateCoordinateExpression('1/4', new Map(), new Map())).toBe(0);
    expect(evaluateCoordinateExpression('1/0', new Map(), new Map())).toBeNull();

    const cycleResult = tryParseCycleStatement([{ lineNo: 1, rawLine: 'bundle {', cleanLine: 'bundle {' }] as any, 0, 'bundle {', 1, { value: 0 }, []);
    expect(cycleResult.stop).toBe(true);
  });

  it('covers cycle-loop runtime-only branch via parser mock', async () => {
    vi.doMock('../packages/compiler-front/src/structured-core/lowering/control-flow-for.js', () => ({
      parseForHeader: () => ({ variable: 'i', start: 0, end: 2, step: 1, runtime: true, control: undefined })
    }));
    const steps = await import('../packages/compiler-front/src/structured-core/lowering/cycle-loop/steps.js');
    const diagnostics: any[] = [];
    const out = steps.tryExpandNestedForLoopStep({
      body: [{ lineNo: 1, rawLine: 'for i in range(0,2) runtime {', cleanLine: 'for i in range(0,2) runtime {' }],
      index: 0,
      entry: { lineNo: 1, rawLine: 'for i in range(0,2) runtime {', cleanLine: 'for i in range(0,2) runtime {' },
      clean: 'for i in range(0,2) runtime {',
      raw: 'for i in range(0,2) runtime {',
      constants: new Map(),
      bindings: new Map(),
      diagnostics
    } as any, () => []);
    expect(out.handled).toBe(true);
    expect(diagnostics.at(-1)?.message).toContain('Runtime for-loops are not supported inside cycle blocks');
  });
});
