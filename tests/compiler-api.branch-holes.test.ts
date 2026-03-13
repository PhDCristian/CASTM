import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AstProgram,
  Diagnostic,
  ErrorCodes,
  HirProgram,
  makeDiagnostic,
  spanAt
} from '@castm/compiler-ir';
import { analyze } from '../packages/compiler-api/src/compiler-driver/analyze-driver.js';
import { createValidateGridPass } from '../packages/compiler-api/src/passes-shared/lowering/validate-grid.js';
import { createResolveSymbolsPass } from '../packages/compiler-api/src/passes-shared/lowering/resolve-symbols/pass.js';
import { createDesugarMemoryPass } from '../packages/compiler-api/src/passes-shared/desugar/memory-pass.js';
import { desugarExpressionsPass } from '../packages/compiler-api/src/passes-shared/desugar/expressions-pass.js';
import {
  parseAllreducePragmaArgs,
  parseBroadcastPragmaArgs,
  parseReducePragmaArgs,
  parseScanPragmaArgs,
  parseStreamLoadPragmaArgs,
  parseStreamStorePragmaArgs
} from '../packages/compiler-api/src/passes-shared/advanced-args.js';
import { parseCoordinateLiteral, parseRoutePragmaArgs } from '../packages/compiler-api/src/passes-shared/route-args.js';
import { buildAllreduceCycles, buildReduceCycles, buildScanCycles } from '../packages/compiler-api/src/passes-shared/collective-builders.js';

const span = spanAt(1, 1, 1);

function makeCycle(index: number, text = 'NOP') {
  return {
    index,
    statements: [
      {
        kind: 'at' as const,
        row: 0,
        col: 0,
        instruction: {
          text,
          opcode: text.split(/\s+/)[0].toUpperCase(),
          operands: [],
          span
        },
        span
      }
    ],
    span
  };
}

function makeAst(cycleCount = 1, targetProfileId: string | null = 'uma-cgra-base'): AstProgram {
  return {
    target: targetProfileId ? { id: targetProfileId, raw: targetProfileId, span } : null,
    targetProfileId,
    span,
    kernel: {
      name: 'k',
      config: undefined,
      cycles: Array.from({ length: cycleCount }, (_, index) => makeCycle(index)),
      pragmas: [],
      directives: [],
      runtime: [],
      span
    }
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
  vi.clearAllMocks();
});

describe('compiler-api branch holes', () => {
  it('analyze returns early when target cannot be resolved', () => {
    const ast = makeAst(1, null);
    const result = analyze(ast, {});
    expect(result.success).toBe(false);
    expect(result.hir).toBeUndefined();
    expect(result.mir).toBeUndefined();
    expect(result.diagnostics.some((d) => d.code === ErrorCodes.Parse.MissingTarget)).toBe(true);
  });

  it('analyze enforces limit(...) after lowering', () => {
    const ast = makeAst(2, 'uma-cgra-base');
    ast.build = {
      optimize: 'O0',
      scheduler: 'safe',
      pruneNoopCycles: false,
      span
    };
    ast.kernel!.runtime!.push({
      kind: 'limit',
      value: '1',
      raw: 'limit(1)',
      span
    });

    const result = analyze(ast, {});
    expect(result.success).toBe(false);
    expect(result.diagnostics.some((d) =>
      d.code === ErrorCodes.Semantic.UnsupportedOperation
      && d.message.includes('limit(...)')
    )).toBe(true);
  });

  it('validate-grid reports collisions and out-of-bounds operations', () => {
    const hir: HirProgram = {
      targetProfileId: 'uma-cgra-base',
      grid: { rows: 2, cols: 2, topology: 'mesh', wrapPolicy: 'clamp' },
      cycles: [
        {
          index: 0,
          span,
          operations: [
            { row: 0, col: 0, instruction: { text: 'NOP', opcode: 'NOP', operands: [], span }, span },
            { row: 0, col: 0, instruction: { text: 'NOP', opcode: 'NOP', operands: [], span }, span },
            { row: 9, col: 9, instruction: { text: 'NOP', opcode: 'NOP', operands: [], span }, span }
          ]
        }
      ]
    };

    const pass = createValidateGridPass({ rows: 2, cols: 2, topology: 'mesh', wrapPolicy: 'clamp' });
    const result = pass.run(hir);
    expect(result.diagnostics.some((d) => d.code === ErrorCodes.Semantic.Collision)).toBe(true);
    expect(result.diagnostics.some((d) => d.code === ErrorCodes.Semantic.CoordinateOutOfBounds)).toBe(true);
  });

  it('resolve-symbols handles null kernel and duplicate labels', () => {
    const pass = createResolveSymbolsPass('uma-cgra-base', {
      rows: 4,
      cols: 4,
      topology: 'torus',
      wrapPolicy: 'wrap'
    });

    const noKernel = pass.run({
      targetProfileId: 'uma-cgra-base',
      kernel: null,
      span
    });
    expect(noKernel.output.cycles).toEqual([]);

    const withDuplicateLabels = pass.run({
      targetProfileId: 'uma-cgra-base',
      span,
      kernel: {
        name: 'k',
        config: undefined,
        directives: [],
        pragmas: [],
        span,
        cycles: [
          { ...makeCycle(0), label: 'L0' },
          { ...makeCycle(1), label: 'L0' }
        ]
      }
    });
    expect(withDuplicateLabels.diagnostics.some((d) => d.code === ErrorCodes.Semantic.DuplicateLabel)).toBe(true);
  });

  it('desugar-memory validates opcode arity and assignment forms', () => {
    const ast = makeAst(1);
    ast.kernel!.cycles = [
      {
        index: 0,
        span,
        statements: [
          {
            kind: 'at',
            row: 0,
            col: 0,
            instruction: { text: 'LWI R1', opcode: 'LWI', operands: ['R1'], span },
            span
          },
          {
            kind: 'at',
            row: 0,
            col: 1,
            instruction: { text: 'A[i] = B[j]', opcode: '', operands: [], span },
            span
          },
          {
            kind: 'at',
            row: 0,
            col: 2,
            instruction: { text: 'A[i] = IMM(1)', opcode: '', operands: [], span },
            span
          },
          {
            kind: 'at',
            row: 0,
            col: 3,
            instruction: { text: 'IMM(1) = A[i]', opcode: '', operands: [], span },
            span
          }
        ]
      }
    ];

    const pass = createDesugarMemoryPass(new Map([
      ['A', { start: 0, length: 4 }]
    ]));
    const result = pass.run(ast);
    expect(result.diagnostics.some((d) => d.message.includes('expects at least 2 operands'))).toBe(true);
    expect(result.diagnostics.some((d) => d.message.includes('Memory-to-memory assignment'))).toBe(true);
    expect(result.diagnostics.some((d) => d.message.includes('Store source must be'))).toBe(true);
    expect(result.diagnostics.some((d) => d.message.includes('Load destination must be'))).toBe(true);
  });

  it('desugar-expressions covers invalid destination and malformed binary expressions', () => {
    const ast = makeAst(1);
    ast.kernel!.cycles = [
      {
        index: 0,
        span,
        statements: [
          {
            kind: 'at',
            row: 0,
            col: 0,
            instruction: { text: 'IMM(2) = R1', opcode: '', operands: [], span },
            span
          },
          {
            kind: 'at',
            row: 0,
            col: 1,
            instruction: { text: 'R1 = + R2', opcode: '', operands: [], span },
            span
          },
          {
            kind: 'at',
            row: 0,
            col: 2,
            instruction: { text: 'R3 = IMM(7)', opcode: '', operands: [], span },
            span
          }
        ]
      }
    ];

    const result = desugarExpressionsPass.run(ast);
    expect(result.diagnostics.some((d) => d.message.includes('Invalid assignment destination'))).toBe(true);
    expect(result.diagnostics.some((d) => d.message.includes('Unsupported expression'))).toBe(true);
    const rewritten = (result.output.kernel?.cycles[0].statements[2] as any).instruction;
    expect(rewritten.opcode).toBe('SADD');
    expect(rewritten.text).toBe('SADD R3, IMM(7), ZERO');
  });

  it('parses advanced args including invalid branches and defaults', () => {
    expect(parseBroadcastPragmaArgs('broadcast(value=R1, from=@0,0, to=row)')).toMatchObject({
      valueReg: 'R1',
      scope: 'row'
    });
    expect(parseBroadcastPragmaArgs('broadcast(value=1, from=@0,0, to=row)')).toBeNull();
    expect(parseBroadcastPragmaArgs('broadcast(value=R1, from=@0,0, to=diag)')).toBeNull();

    expect(parseScanPragmaArgs('scan(op=add, src=R0, dest=R1, dir=left, mode=exclusive)')).toMatchObject({
      direction: 'left',
      mode: 'exclusive'
    });
    expect(parseScanPragmaArgs('scan(op=add, src=R0, dest=R1, dir=diag)')).toBeNull();
    expect(parseScanPragmaArgs('scan(op=add, src=R0, dest=R1, dir=left, mode=other)')).toBeNull();

    expect(parseReducePragmaArgs('reduce(op=add, dest=R1, src=R0, axis=col)')).toMatchObject({
      axis: 'col'
    });
    expect(parseReducePragmaArgs('reduce(op=add, dest=R1, src=R0, axis=diag)')).toBeNull();

    expect(parseAllreducePragmaArgs('allreduce(op=add, dest=R1, src=R0)')).toMatchObject({
      axis: 'row'
    });
    expect(parseAllreducePragmaArgs('allreduce(op=add, dest=R1, src=R0, axis=diag)')).toBeNull();

    expect(parseStreamLoadPragmaArgs('stream_load(dest=R1)')).toEqual({
      destReg: 'R1',
      row: 0,
      count: 1
    });
    expect(parseStreamLoadPragmaArgs('stream_load(dest=R1, row=a)')).toBeNull();
    expect(parseStreamStorePragmaArgs('stream_store(src=R1)')).toEqual({
      srcReg: 'R1',
      row: 0,
      count: 1
    });
    expect(parseStreamStorePragmaArgs('stream_store(src=R1, count=a)')).toBeNull();
  });

  it('parses route coordinate/args error branches', () => {
    expect(parseCoordinateLiteral('@1,2')).toEqual({ row: 1, col: 2 });
    expect(parseCoordinateLiteral('@1,2 extra')).toBeNull();
    expect(parseCoordinateLiteral('1,2')).toBeNull();

    expect(parseRoutePragmaArgs('route(@0,1 -> @0,0, payload=R3, accum=R1)')).toMatchObject({
      payload: 'R3',
      accum: 'R1'
    });
    expect(parseRoutePragmaArgs('route(@0,1 -> @0,0, payload=R3, dest=R1, op=BAD())')).toBeNull();
    expect(parseRoutePragmaArgs('route(@0,1 -> @0,0, payload=R3)')).toBeNull();
  });

  it('collective builders cover unsupported operations and compare-mode paths', () => {
    const diagnostics: Diagnostic[] = [];
    const grid: any = { rows: 4, cols: 4, topology: 'torus', wrapPolicy: 'wrap' };
    const emptyGrid: any = { rows: 0, cols: 4, topology: 'mesh', wrapPolicy: 'clamp' };

    const badReduce = buildReduceCycles(
      { operation: 'pow', destReg: 'R1', srcReg: 'R0', axis: 'row' },
      0,
      grid,
      span,
      diagnostics
    );
    expect(badReduce).toEqual([]);
    expect(diagnostics.some((d) => d.message.includes('Unsupported reduce operation'))).toBe(true);

    const maxReduce = buildReduceCycles(
      { operation: 'max', destReg: 'R1', srcReg: 'R0', axis: 'row' },
      0,
      grid,
      span,
      []
    );
    expect(maxReduce.some((cycle) =>
      cycle.statements.some((stmt) => stmt.kind === 'at' && stmt.instruction.opcode === 'BSFA')
    )).toBe(true);

    expect(buildScanCycles(
      { operation: 'pow', srcReg: 'R0', dstReg: 'R1', direction: 'left', mode: 'inclusive' },
      0,
      grid,
      span,
      []
    )).toEqual([]);

    const minScan = buildScanCycles(
      { operation: 'min', srcReg: 'R0', dstReg: 'R1', direction: 'right', mode: 'exclusive' },
      1,
      grid,
      span,
      []
    );
    expect(minScan.length).toBeGreaterThan(0);
    expect(minScan.some((cycle) =>
      cycle.statements.some((stmt) => stmt.kind === 'at' && stmt.instruction.opcode === 'BSFA')
    )).toBe(true);

    expect(buildScanCycles(
      { operation: 'add', srcReg: 'R0', dstReg: 'R1', direction: 'up', mode: 'inclusive' },
      0,
      emptyGrid,
      span,
      []
    )).toEqual([]);

    const allreduceError = buildAllreduceCycles(
      { operation: 'pow', destReg: 'R1', srcReg: 'R0', axis: 'row' },
      0,
      grid,
      span,
      []
    );
    expect(allreduceError).toEqual([]);

    const allreduceCol = buildAllreduceCycles(
      { operation: 'add', destReg: 'R1', srcReg: 'R0', axis: 'col' },
      0,
      grid,
      span,
      []
    );
    expect(allreduceCol.length).toBeGreaterThan(0);
  });

  it('compile driver covers parse-error fallback with mocked parse result carrying ast', async () => {
    vi.doMock('../packages/compiler-api/src/compiler-driver/parse-driver.js', () => ({
      parse: () => {
        const ast = makeAst(1);
        return {
          success: false,
          ast,
          structuredAst: undefined,
          diagnostics: [
            makeDiagnostic(
              ErrorCodes.Parse.InvalidSyntax,
              'error',
              span,
              'mock parse failure'
            )
          ]
        };
      }
    }));

    const { compile } = await import('../packages/compiler-api/src/compiler-driver/compile-driver.js');
    const result = compile('target "uma-cgra-base"; kernel "k" {}');
    expect(result.success).toBe(false);
    expect(result.artifacts.ast).toBeDefined();
    expect(result.artifacts.hir).toBeUndefined();
    expect(result.stats.instructions).toBe(0);
  });
});
