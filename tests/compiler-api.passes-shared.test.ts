import { describe, expect, it } from 'vitest';
import {
  cloneAst,
  createAtCycle,
  createInstruction,
  createMultiAtCycle,
  createRowCycle,
  replaceIncoming
} from '../packages/compiler-api/src/passes-shared/ast-utils.js';
import {
  extractPragmaName,
  extractStatementBody,
  isIdentifier,
  isNumericLiteralToken,
  parseIntegerLiteral,
  parseKeyValueArgs,
  splitPositionalArgs
} from '../packages/compiler-api/src/passes-shared/pragma-args-utils.js';
import {
  computeRoutePath,
  getIncomingRegister,
  isPointInGrid,
  isSamePoint,
  wrap
} from '../packages/compiler-api/src/passes-shared/grid-utils.js';
import {
  parseCoordinateLiteral,
  parseRoutePragmaArgs
} from '../packages/compiler-api/src/passes-shared/route-args.js';
import {
  parseAllreducePragmaArgs,
  parseBroadcastPragmaArgs,
  parseGatherPragmaArgs,
  parseReducePragmaArgs,
  parseRotateShiftPragmaArgs,
  parseScanPragmaArgs,
  parseStencilPragmaArgs,
  parseStreamLoadPragmaArgs,
  parseStreamStorePragmaArgs,
  parseTransposePragmaArgs
} from '../packages/compiler-api/src/passes-shared/advanced-args.js';
import {
  buildReduceCycles,
  buildScanCycles,
  buildStreamCycles
} from '../packages/compiler-api/src/passes-shared/collective-builders.js';
import {
  buildRouteCycles
} from '../packages/compiler-api/src/passes-shared/route-builders.js';
import {
  splitAssignment,
  splitTopLevelBinary,
  toAddressOperand
} from '../packages/compiler-api/src/passes-shared/desugar-utils.js';

describe('compiler-api passes shared utils', () => {
  it('parses pragma helpers and numeric literals', () => {
    expect(extractPragmaName('route(@0,1 -> @0,0, payload=R1)')).toBe('route');
    expect(extractStatementBody('scan(op=add, src=R0, dest=R1)', 'scan')).toBe('op=add, src=R0, dest=R1');

    expect(isIdentifier('R0')).toBe(true);
    expect(isIdentifier('0R')).toBe(false);

    expect(isNumericLiteralToken('42')).toBe(true);
    expect(isNumericLiteralToken('-0x10')).toBe(true);
    expect(isNumericLiteralToken('R0')).toBe(false);

    expect(parseIntegerLiteral('17')).toBe(17);
    expect(parseIntegerLiteral('-0x10')).toBe(-16);
    expect(parseIntegerLiteral('bad')).toBeNull();
  });

  it('splits positional and key-value args with nested expressions', () => {
    expect(splitPositionalArgs('R1, SMUL(R0, R2, INCOMING), IMM(4)')).toEqual([
      'R1',
      'SMUL(R0, R2, INCOMING)',
      'IMM(4)'
    ]);

    const args = parseKeyValueArgs('payload=R3, op=SMUL(R1, R0, INCOMING), dest=R1');
    expect(args?.get('payload')).toBe('R3');
    expect(args?.get('op')).toBe('SMUL(R1, R0, INCOMING)');
    expect(args?.get('dest')).toBe('R1');
  });

  it('creates cloned instruction/cycle structures and keeps immutability', () => {
    const span = { startLine: 1, startColumn: 1, endLine: 1, endColumn: 5 };
    const instruction = createInstruction('sadd', ['R1', 'R2', 'R3'], span);
    const atCycle = createAtCycle(0, 0, 1, instruction, span, 'L0');
    const rowCycle = createRowCycle(1, 2, [instruction], span);
    const multi = createMultiAtCycle(2, [{ row: 0, col: 0, instruction }], span);

    expect(atCycle.label).toBe('L0');
    expect(rowCycle.statements[0].kind).toBe('row');
    expect(multi.statements).toHaveLength(1);
    expect(replaceIncoming('INCOMING', 'RCL')).toBe('RCL');

    const ast: any = {
      targetProfileId: 'uma-cgra-base',
      kernel: {
        name: 'k',
        config: undefined,
        directives: [],
        pragmas: [],
        cycles: [atCycle],
        span
      },
      span
    };

    const cloned = cloneAst(ast);
    cloned.kernel!.cycles[0].index = 99;
    expect(ast.kernel.cycles[0].index).toBe(0);
  });

  it('computes route utilities for torus and mesh grids', () => {
    const torusGrid: any = { rows: 4, cols: 4, topology: 'torus', wrapPolicy: 'wrap' };
    const meshGrid: any = { rows: 4, cols: 4, topology: 'mesh', wrapPolicy: 'clamp' };

    expect(wrap(-1, 4)).toBe(3);
    expect(isSamePoint({ row: 1, col: 1 }, { row: 1, col: 1 })).toBe(true);
    expect(isPointInGrid({ row: 3, col: 3 }, torusGrid)).toBe(true);
    expect(isPointInGrid({ row: 4, col: 0 }, torusGrid)).toBe(false);

    const torusPath = computeRoutePath({ row: 0, col: 0 }, { row: 0, col: 3 }, torusGrid);
    expect(torusPath).toEqual([{ row: 0, col: 0 }, { row: 0, col: 3 }]);
    expect(getIncomingRegister(torusPath[0], torusPath[1], torusGrid)).toBe('RCR');

    const meshPath = computeRoutePath({ row: 0, col: 0 }, { row: 2, col: 1 }, meshGrid);
    expect(meshPath[0]).toEqual({ row: 0, col: 0 });
    expect(meshPath[meshPath.length - 1]).toEqual({ row: 2, col: 1 });
  });

  it('parses route arguments and coordinate literals', () => {
    expect(parseCoordinateLiteral('@0,3')).toEqual({ row: 0, col: 3 });
    expect(parseCoordinateLiteral('(1, 2)')).toEqual({ row: 1, col: 2 });

    const simple = parseRoutePragmaArgs('route(@0,1 -> @0,0, payload=R3, accum=R1)');
    expect(simple).toMatchObject({
      src: { row: 0, col: 1 },
      dst: { row: 0, col: 0 },
      payload: 'R3',
      accum: 'R1'
    });

    const withOp = parseRoutePragmaArgs('route(@0,1 -> @0,0, payload=R3, dest=R1, op=SMUL(R1, R0, INCOMING))');
    expect(withOp?.customOp).toMatchObject({
      opcode: 'SMUL',
      dest: 'R1',
      srcA: 'R0',
      srcB: 'INCOMING'
    });
  });

  it('parses advanced pragma argument groups', () => {
    expect(parseBroadcastPragmaArgs('broadcast(value=R1, from=@0,0, to=row)')).toMatchObject({
      valueReg: 'R1',
      from: { row: 0, col: 0 },
      scope: 'row'
    });
    expect(parseRotateShiftPragmaArgs('rotate(reg=R1, direction=left, distance=2)', 'rotate')).toMatchObject({
      reg: 'R1',
      direction: 'left',
      distance: 2
    });
    expect(parseScanPragmaArgs('scan(op=add, src=R0, dest=R1, dir=left, mode=inclusive)')).toMatchObject({
      operation: 'add',
      srcReg: 'R0',
      dstReg: 'R1',
      direction: 'left',
      mode: 'inclusive'
    });
    expect(parseReducePragmaArgs('reduce(op=add, dest=R1, src=R0, axis=row)')).toMatchObject({
      operation: 'add',
      destReg: 'R1',
      srcReg: 'R0',
      axis: 'row'
    });
    expect(parseStencilPragmaArgs('stencil(cross, add, R0, R1)')).toMatchObject({
      pattern: 'cross',
      operation: 'add',
      srcReg: 'R0',
      destReg: 'R1'
    });
    expect(parseAllreducePragmaArgs('allreduce(op=add, dest=R1, src=R0, axis=col)')).toMatchObject({
      operation: 'add',
      destReg: 'R1',
      srcReg: 'R0',
      axis: 'col'
    });
    expect(parseTransposePragmaArgs('transpose(reg=R2)')).toEqual({ reg: 'R2' });
    expect(parseGatherPragmaArgs('gather(src=R0, dest=@1,1, destReg=R2, op=add)')).toMatchObject({
      srcReg: 'R0',
      dest: { row: 1, col: 1 },
      destReg: 'R2',
      operation: 'add'
    });
    expect(parseStreamLoadPragmaArgs('stream_load(dest=R1, row=2, count=4)')).toMatchObject({
      destReg: 'R1',
      row: 2,
      count: 4
    });
    expect(parseStreamStorePragmaArgs('stream_store(src=R1, row=2, count=4)')).toMatchObject({
      srcReg: 'R1',
      row: 2,
      count: 4
    });
  });

  it('builds route and collective cycles with deterministic structure', () => {
    const diagnostics: any[] = [];
    const span = { startLine: 1, startColumn: 1, endLine: 1, endColumn: 2 };
    const grid: any = { rows: 4, cols: 4, topology: 'torus', wrapPolicy: 'wrap' };

    const routeCycles = buildRouteCycles(
      {
        src: { row: 0, col: 1 },
        dst: { row: 0, col: 0 },
        payload: 'R3',
        accum: 'R1'
      },
      0,
      grid,
      span,
      diagnostics
    );
    expect(routeCycles.length).toBeGreaterThan(0);
    expect(routeCycles[0].index).toBe(0);

    const scanCycles = buildScanCycles(
      {
        operation: 'add',
        srcReg: 'R0',
        dstReg: 'R1',
        direction: 'left',
        mode: 'inclusive'
      },
      routeCycles.length,
      grid,
      span,
      diagnostics
    );
    expect(scanCycles.length).toBeGreaterThan(0);

    const reduceCycles = buildReduceCycles(
      {
        operation: 'add',
        destReg: 'R1',
        srcReg: 'R0',
        axis: 'row'
      },
      routeCycles.length + scanCycles.length,
      grid,
      span,
      diagnostics
    );
    expect(reduceCycles.length).toBeGreaterThan(0);

    const streamCycles = buildStreamCycles('LWD', 'R1', 1, 2, 0, grid, span, diagnostics);
    expect(streamCycles).toHaveLength(2);
    expect(diagnostics).toHaveLength(0);
  });

  it('handles desugar utilities for assignment, binary split and memory addresses', () => {
    expect(splitAssignment('R1 = A[i]')).toEqual({ lhs: 'R1', rhs: 'A[i]' });
    expect(splitAssignment('R1 == R2')).toBeNull();

    expect(splitTopLevelBinary('R1 + IMM(4)')).toEqual({ left: 'R1', op: '+', right: 'IMM(4)' });
    expect(splitTopLevelBinary('foo(R1 + R2)')).toBeNull();

    const diagnostics: any[] = [];
    const symbols = new Map<string, any>([
      ['A', { start: 100, length: 8 }],
      ['M', { start: 200, length: 16, rows: 4, cols: 4 }]
    ]);
    const span = { startLine: 1, startColumn: 1, endLine: 1, endColumn: 2 };

    expect(toAddressOperand('[360 + i*4]', symbols, diagnostics, span)).toBe('360 + i*4');
    expect(toAddressOperand('A[2]', symbols, diagnostics, span)).toBe('108');
    expect(toAddressOperand('M[1][2]', symbols, diagnostics, span)).toBe('224');
    expect(diagnostics).toHaveLength(0);
  });
});
