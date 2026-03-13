import { describe, expect, it } from 'vitest';
import { ErrorCodes } from '@castm/compiler-ir';
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
  parseAccumulatePragmaArgs,
  parseAllreducePragmaArgs,
  parseBroadcastPragmaArgs,
  parseCarryChainPragmaArgs,
  parseCollectPragmaArgs,
  parseConditionalSubPragmaArgs,
  parseExtractBytesPragmaArgs,
  parseGuardPragmaArgs,
  parseGatherPragmaArgs,
  parseMulaccChainPragmaArgs,
  parseNormalizePragmaArgs,
  parseStashPragmaArgs,
  parseReducePragmaArgs,
  parseRotateShiftPragmaArgs,
  parseScanPragmaArgs,
  parseStencilPragmaArgs,
  parseStreamLoadPragmaArgs,
  parseStreamStorePragmaArgs,
  parseTrianglePragmaArgs,
  parseTransposePragmaArgs
} from '../packages/compiler-api/src/passes-shared/advanced-args.js';
import {
  buildAccumulateCycles,
  buildCarryChainCycles,
  buildCollectCycles,
  buildConditionalSubCycles,
  buildExtractBytesCycles,
  buildNormalizeCycles,
  buildReduceCycles,
  buildScanCycles,
  buildGuardCycles,
  buildStreamCycles,
  buildTriangleCycles
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
    expect(parseCoordinateLiteral('(1, 2)')).toBeNull();

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
    expect(parseTrianglePragmaArgs('triangle(shape=upper, inclusive=true, op=SMUL, dest=R2, srcA=R0, srcB=R1)')).toMatchObject({
      shape: 'upper',
      inclusive: true,
      opcode: 'SMUL',
      destReg: 'R2',
      srcA: 'R0',
      srcB: 'R1'
    });
    expect(parseTrianglePragmaArgs('triangle(shape=upper, op=SMUL, dest=R2, srcA=R0, srcB=R1)')).toMatchObject({
      inclusive: true
    });
    expect(parseTrianglePragmaArgs('triangle(shape=upper, inclusive=exclusive, op=SMUL, dest=R2, srcA=R0, srcB=R1)')).toMatchObject({
      inclusive: false
    });
    expect(parseTrianglePragmaArgs('triangle(shape=upper, inclusive=maybe, op=SMUL, dest=R2, srcA=R0, srcB=R1)')).toBeNull();
    expect(parseTrianglePragmaArgs('triangle(shape=upper, op=SMUL, dest=R2, srcA=R0, srcB=R1, extra=1)')).toBeNull();
    expect(parseTrianglePragmaArgs('triangle(shape=upper, op=SMUL, dest=R2, srcA=1, srcB=R1)')).toBeNull();
    expect(parseTrianglePragmaArgs('foo(shape=upper, op=SMUL, dest=R2, srcA=R0, srcB=R1)')).toBeNull();
    expect(parseGuardPragmaArgs('guard(cond=col>=row, op=SMUL, dest=R2, srcA=R0, srcB=R1)')).toMatchObject({
      condition: 'col>=row',
      opcode: 'SMUL',
      destReg: 'R2',
      srcA: 'R0',
      srcB: 'R1'
    });
    expect(parseGuardPragmaArgs('guard(cond=col>=row, op=SMUL, dest=R2, srcA=R0)')).toBeNull();
    expect(parseGuardPragmaArgs('guard(cond=col>=row, op=SMUL, dest=R2, srcA=R0, srcB=R1, extra=1)')).toBeNull();
    expect(parseGuardPragmaArgs('guard(cond=col>=row, op=SMUL, dest=R2, srcA=1, srcB=R1)')).toBeNull();
    expect(parseGuardPragmaArgs('foo(cond=col>=row, op=SMUL, dest=R2, srcA=R0, srcB=R1)')).toBeNull();
    expect(parseCollectPragmaArgs('collect(from=row(1), to=row(0), via=RCB, local=R2, into=R3, combine=add)')).toMatchObject({
      from: { axis: 'row', index: 1 },
      to: { axis: 'row', index: 0 },
      viaReg: 'RCB',
      localReg: 'R2',
      destReg: 'R3',
      combine: 'add'
    });
    expect(parseCollectPragmaArgs('collect(from=col(0), via=SELF, local=R2, into=R3)')).toMatchObject({
      from: { axis: 'col', index: 0 },
      to: { axis: 'col', index: 0 },
      combine: 'add'
    });
    expect(parseCollectPragmaArgs('collect(from=row(1), to=col(0), via=RCB, local=R2, into=R3)')).toBeNull();
    expect(parseCollectPragmaArgs('collect(from=row(1), via=RCB, local=R2, into=R3, extra=1)')).toBeNull();
    expect(parseCollectPragmaArgs('collect(from=row(x), via=RCB, local=R2, into=R3)')).toBeNull();
    expect(parseCollectPragmaArgs('collect(from=row(1), to=row(x), via=RCB, local=R2, into=R3)')).toBeNull();
    expect(parseCollectPragmaArgs('collect(via=RCB, local=R2, into=R3)')).toBeNull();
    expect(parseCollectPragmaArgs('collect(from=row(1), via=RCB, local=R2, into=R3, combine=bad)')).toBeNull();
    expect(parseCollectPragmaArgs('collect(from=row(1), via=RCB, local=1, into=R3)')).toBeNull();
    expect(parseCollectPragmaArgs('foo(from=row(1), via=RCB, local=R2, into=R3)')).toBeNull();
    expect(parseStashPragmaArgs('stash(action=save, reg=R0, addr=L[0], target=point(3,0))')).toMatchObject({
      action: 'save',
      reg: 'R0',
      addr: 'L[0]',
      target: { kind: 'point', row: 3, col: 0 }
    });
    expect(parseStashPragmaArgs('stash(action=restore, reg=R1, addr=L[0], target=row(1))')).toMatchObject({
      action: 'restore',
      target: { kind: 'row', index: 1 }
    });
    expect(parseStashPragmaArgs('stash(action=save, reg=R0, addr=L[0])')).toMatchObject({
      target: { kind: 'all' }
    });
    expect(parseStashPragmaArgs('stash(action=bad, reg=R0, addr=L[0])')).toBeNull();
    expect(parseStashPragmaArgs('stash(action=save, reg=1, addr=L[0])')).toBeNull();
    expect(parseStashPragmaArgs('stash(action=save, reg=R0, addr=L[0], target=diag(1))')).toBeNull();
    expect(parseStashPragmaArgs('stash(action=save, reg=R0, addr=L[0], extra=1)')).toBeNull();
    expect(parseStashPragmaArgs('foo(action=save, reg=R0, addr=L[0])')).toBeNull();
    expect(parseAccumulatePragmaArgs('accumulate(pattern=anti_diagonal, products=R2, accum=R3, out=ROUT, combine=add)')).toMatchObject({
      pattern: 'anti_diagonal',
      productsReg: 'R2',
      accumReg: 'R3',
      outReg: 'ROUT',
      combine: 'add',
      steps: 1,
      scope: { kind: 'all' }
    });
    expect(parseAccumulatePragmaArgs('accumulate(pattern=row, products=R2, accum=R3, out=ROUT)')).toMatchObject({
      pattern: 'row',
      combine: 'add',
      steps: 1,
      scope: { kind: 'all' }
    });
    expect(parseAccumulatePragmaArgs('accumulate(pattern=row, products=R2, accum=R3, out=ROUT, steps=2)')).toMatchObject({
      pattern: 'row',
      combine: 'add',
      steps: 2,
      scope: { kind: 'all' }
    });
    expect(parseAccumulatePragmaArgs('accumulate(pattern=row, products=R2, accum=R3, out=ROUT, scope=row(2))')).toMatchObject({
      pattern: 'row',
      scope: { kind: 'row', index: 2 }
    });
    expect(parseAccumulatePragmaArgs('accumulate(pattern=col, products=R2, accum=R3, out=ROUT, scope=col(1))')).toMatchObject({
      pattern: 'col',
      scope: { kind: 'col', index: 1 }
    });
    expect(parseAccumulatePragmaArgs('accumulate(pattern=col, products=R2, accum=R3, out=ROUT, scope=all)')).toMatchObject({
      pattern: 'col',
      scope: { kind: 'all' }
    });
    expect(parseAccumulatePragmaArgs('accumulate(pattern=diag, products=R2, accum=R3, out=ROUT)')).toBeNull();
    expect(parseAccumulatePragmaArgs('accumulate(pattern=row, products=R2, out=ROUT)')).toBeNull();
    expect(parseAccumulatePragmaArgs('accumulate(pattern=row, products=R2, accum=R3, out=1)')).toBeNull();
    expect(parseAccumulatePragmaArgs('accumulate(pattern=row, products=R2, accum=R3, out=ROUT, combine=bad)')).toBeNull();
    expect(parseAccumulatePragmaArgs('accumulate(pattern=row, products=R2, accum=R3, out=ROUT, steps=0)')).toBeNull();
    expect(parseAccumulatePragmaArgs('accumulate(pattern=row, products=R2, accum=R3, out=ROUT, steps=-1)')).toBeNull();
    expect(parseAccumulatePragmaArgs('accumulate(pattern=row, products=R2, accum=R3, out=ROUT, steps=1.5)')).toBeNull();
    expect(parseAccumulatePragmaArgs('accumulate(pattern=row, products=R2, accum=R3, out=ROUT, scope=diag(1))')).toBeNull();
    expect(parseAccumulatePragmaArgs('accumulate(pattern=row, products=R2, accum=R3, out=ROUT, scope=row(x))')).toBeNull();
    expect(parseAccumulatePragmaArgs('accumulate(pattern=row, products=R2, accum=R3, out=ROUT, extra=1)')).toBeNull();
    expect(parseAccumulatePragmaArgs('foo(pattern=row, products=R2, accum=R3, out=ROUT)')).toBeNull();
    expect(parseMulaccChainPragmaArgs('mulacc_chain(src=R0, coeff=R1, acc=R3, out=R0, target=row(0), width=16, dir=right)')).toMatchObject({
      srcReg: 'R0',
      coeffReg: 'R1',
      accReg: 'R3',
      outReg: 'R0',
      target: { kind: 'row', index: 0 },
      width: 16,
      mask: 65535,
      direction: 'right'
    });
    expect(parseMulaccChainPragmaArgs('mulacc_chain(src=R0, coeff=R1, acc=R3, out=R0, target=col(1), lanes=2, width=16, mask=65535, dir=down)')).toMatchObject({
      target: { kind: 'col', index: 1 },
      lanes: 2,
      direction: 'down'
    });
    expect(parseMulaccChainPragmaArgs('mulacc_chain(src=R0, coeff=R1, acc=R3, out=R0, target=diag(0), width=16, dir=right)')).toBeNull();
    expect(parseMulaccChainPragmaArgs('mulacc_chain(src=R0, coeff=R1, acc=R3, out=R0, target=row(0), width=16, dir=bad)')).toBeNull();
    expect(parseConditionalSubPragmaArgs('conditional_sub(value=R0, sub=R1, dest=R2)')).toMatchObject({
      valueReg: 'R0',
      subReg: 'R1',
      destReg: 'R2',
      target: { kind: 'all' }
    });
    expect(parseConditionalSubPragmaArgs('conditional_sub(value=R0, sub=R1, dest=R2, target=row(1))')).toMatchObject({
      target: { kind: 'row', index: 1 }
    });
    expect(parseConditionalSubPragmaArgs('conditional_sub(value=R0, sub=R1, dest=R2, target=point(1,2))')).toMatchObject({
      target: { kind: 'point', row: 1, col: 2 }
    });
    expect(parseConditionalSubPragmaArgs('conditional_sub(value=R0, sub=R1, target=row(1))')).toBeNull();
    expect(parseConditionalSubPragmaArgs('conditional_sub(value=R0, sub=R1, dest=R2, target=diag(1))')).toBeNull();
    expect(parseConditionalSubPragmaArgs('conditional_sub(value=R0, sub=R1, dest=1)')).toBeNull();
    expect(parseConditionalSubPragmaArgs('conditional_sub(value=R0, sub=R1, dest=R2, extra=1)')).toBeNull();
    expect(parseConditionalSubPragmaArgs('foo(value=R0, sub=R1, dest=R2)')).toBeNull();
    expect(parseCarryChainPragmaArgs('carry_chain(src=R0, carry=R3, store=L, limbs=4, width=16, row=0)')).toMatchObject({
      srcReg: 'R0',
      carryReg: 'R3',
      storeSymbol: 'L',
      limbs: 4,
      width: 16,
      row: 0,
      startCol: 0,
      direction: 'right',
      mask: 65535
    });
    expect(parseCarryChainPragmaArgs('carry_chain(src=R0, carry=R3, store=L, limbs=2, width=8, row=1, start=3, dir=left, mask=255)')).toMatchObject({
      startCol: 3,
      direction: 'left',
      mask: 255
    });
    expect(parseCarryChainPragmaArgs('carry_chain(src=R0, carry=R3, store=L, limbs=0, width=16, row=0)')).toBeNull();
    expect(parseCarryChainPragmaArgs('carry_chain(src=R0, carry=R3, store=L, limbs=4, width=31, row=0)')).toBeNull();
    expect(parseCarryChainPragmaArgs('carry_chain(src=R0, carry=R3, store=L, limbs=4, width=16, row=0, dir=diag)')).toBeNull();
    expect(parseCarryChainPragmaArgs('carry_chain(src=R0, carry=R3, store=L, limbs=4, width=16, row=0, start=foo)')).toBeNull();
    expect(parseCarryChainPragmaArgs('carry_chain(src=R0, carry=R3, store=1, limbs=4, width=16, row=0)')).toBeNull();
    expect(parseCarryChainPragmaArgs('carry_chain(src=R0, carry=R3, limbs=4, width=16, row=0)')).toBeNull();
    expect(parseCarryChainPragmaArgs('carry_chain(src=R0, carry=R3, store=L, limbs=4, width=16)')).toBeNull();
    expect(parseCarryChainPragmaArgs('carry_chain(src=R0, carry=R3, store=L, limbs=4, width=16, row=foo)')).toBeNull();
    expect(parseCarryChainPragmaArgs('carry_chain(src=R0, carry=R3, store=L, limbs=4, width=16, row=0, mask=foo)')).toBeNull();
    expect(parseCarryChainPragmaArgs('carry_chain(src=R0, carry=R3, store=L, limbs=4, width=16, row=0, extra=1)')).toBeNull();
    expect(parseCarryChainPragmaArgs('foo(src=R0, carry=R3, store=L, limbs=4, width=16, row=0)')).toBeNull();
    expect(parseNormalizePragmaArgs('normalize(reg=R3, carry=R1, width=16, lane=0)')).toMatchObject({
      reg: 'R3',
      carryReg: 'R1',
      width: 16,
      mask: 65535,
      axis: 'row',
      lane: 0,
      direction: 'right'
    });
    expect(parseNormalizePragmaArgs('normalize(reg=R3, carry=R1, width=8, lane=1, axis=col, dir=up, mask=255)')).toMatchObject({
      axis: 'col',
      direction: 'up',
      mask: 255
    });
    expect(parseNormalizePragmaArgs('normalize(reg=R3, carry=R1, width=16, lane=0, axis=row, dir=up)')).toBeNull();
    expect(parseNormalizePragmaArgs('normalize(reg=R3, carry=R1, width=16, lane=0, axis=diag)')).toBeNull();
    expect(parseNormalizePragmaArgs('normalize(reg=R3, carry=R1, width=16, lane=0, dir=zigzag)')).toBeNull();
    expect(parseNormalizePragmaArgs('normalize(reg=1, carry=R1, width=16, lane=0)')).toBeNull();
    expect(parseNormalizePragmaArgs('normalize(reg=R3, carry=1, width=16, lane=0)')).toBeNull();
    expect(parseNormalizePragmaArgs('normalize(reg=R3, carry=R1, width=foo, lane=0)')).toBeNull();
    expect(parseNormalizePragmaArgs('normalize(reg=R3, carry=R1, width=16, lane=foo)')).toBeNull();
    expect(parseNormalizePragmaArgs('normalize(reg=R3, carry=R1, width=16, lane=0, axis=col, dir=left)')).toBeNull();
    expect(parseNormalizePragmaArgs('normalize(reg=R3, carry=R1, width=16, lane=0, mask=foo)')).toBeNull();
    expect(parseNormalizePragmaArgs('normalize(reg=R3 carry=R1, width=16, lane=0)')).toBeNull();
    expect(parseNormalizePragmaArgs('normalize(reg=R3, carry=R1, width=31, lane=0)')).toBeNull();
    expect(parseNormalizePragmaArgs('normalize(reg=R3, carry=R1, width=16)')).toBeNull();
    expect(parseNormalizePragmaArgs('normalize(reg=R3, carry=R1, width=16, lane=0, extra=1)')).toBeNull();
    expect(parseNormalizePragmaArgs('foo(reg=R3, carry=R1, width=16, lane=0)')).toBeNull();
    expect(parseExtractBytesPragmaArgs('extract_bytes(src=R0, dest=R1, axis=row, byteWidth=8, mask=255)')).toMatchObject({
      srcReg: 'R0',
      destReg: 'R1',
      axis: 'row',
      byteWidth: 8,
      mask: 255
    });
    expect(parseExtractBytesPragmaArgs('extract_bytes(src=R0, dest=R1)')).toMatchObject({
      axis: 'col',
      byteWidth: 8,
      mask: 255
    });
    expect(parseExtractBytesPragmaArgs('extract_bytes(src=R0, dest=R1, axis=diag)')).toBeNull();
    expect(parseExtractBytesPragmaArgs('extract_bytes(src=R0, dest=1)')).toBeNull();
    expect(parseExtractBytesPragmaArgs('extract_bytes(src=R0, dest=R1, byteWidth=0)')).toBeNull();
    expect(parseExtractBytesPragmaArgs('extract_bytes(src=R0, dest=R1, mask=foo)')).toBeNull();
    expect(parseExtractBytesPragmaArgs('extract_bytes(src=R0, dest=R1, extra=1)')).toBeNull();
    expect(parseExtractBytesPragmaArgs('foo(src=R0, dest=R1)')).toBeNull();
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

    const triangleCycles = buildTriangleCycles(
      {
        shape: 'upper',
        inclusive: true,
        opcode: 'SMUL',
        destReg: 'R2',
        srcA: 'R0',
        srcB: 'R1'
      },
      3,
      grid,
      span
    );
    expect(triangleCycles).toHaveLength(1);
    expect(triangleCycles[0].statements.length).toBe(10);

    const upperExclusive = buildTriangleCycles(
      {
        shape: 'upper',
        inclusive: false,
        opcode: 'SMUL',
        destReg: 'R2',
        srcA: 'R0',
        srcB: 'R1'
      },
      4,
      grid,
      span
    );
    expect(upperExclusive[0].statements.length).toBe(6);

    const lowerInclusive = buildTriangleCycles(
      {
        shape: 'lower',
        inclusive: true,
        opcode: 'SADD',
        destReg: 'R1',
        srcA: 'R0',
        srcB: 'ZERO'
      },
      5,
      grid,
      span
    );
    expect(lowerInclusive[0].statements.length).toBe(10);

    const emptyTriangle = buildTriangleCycles(
      {
        shape: 'upper',
        inclusive: true,
        opcode: 'SMUL',
        destReg: 'R2',
        srcA: 'R0',
        srcB: 'R1'
      },
      0,
      { rows: 0, cols: 0, topology: 'mesh', wrapPolicy: 'clamp' },
      span
    );
    expect(emptyTriangle).toEqual([]);

    const guardCycles = buildGuardCycles(
      {
        condition: 'col>=row',
        opcode: 'SMUL',
        destReg: 'R2',
        srcA: 'R0',
        srcB: 'R1'
      },
      6,
      grid,
      span,
      diagnostics
    );
    expect(guardCycles).toHaveLength(1);
    expect(guardCycles[0].statements.length).toBe(10);

    const guardTruthiness = buildGuardCycles(
      {
        condition: 'idx%2',
        opcode: 'SADD',
        destReg: 'R1',
        srcA: 'R0',
        srcB: 'ZERO'
      },
      7,
      grid,
      span,
      diagnostics
    );
    expect(guardTruthiness).toHaveLength(1);
    expect(guardTruthiness[0].statements.length).toBe(8);

    const accumulateCycles = buildAccumulateCycles(
      {
        pattern: 'anti_diagonal',
        productsReg: 'R2',
        accumReg: 'R3',
        outReg: 'ROUT',
        combine: 'add'
      },
      48,
      grid,
      span,
      diagnostics
    );
    expect(accumulateCycles).toHaveLength(4);
    expect(accumulateCycles[0].statements[0]).toMatchObject({
      kind: 'at',
      instruction: { opcode: 'SADD', operands: ['R3', 'R2', 'ZERO'] }
    });
    expect(accumulateCycles[3].statements[0]).toMatchObject({
      kind: 'at',
      instruction: { opcode: 'SADD', operands: ['ROUT', 'R3', 'ZERO'] }
    });

    const conditionalSubCycles = buildConditionalSubCycles(
      {
        valueReg: 'R0',
        subReg: 'R1',
        destReg: 'R2',
        target: { kind: 'point', row: 1, col: 2 }
      },
      60,
      grid,
      span,
      diagnostics
    );
    expect(conditionalSubCycles).toHaveLength(2);
    expect(conditionalSubCycles[0].statements[0]).toMatchObject({
      kind: 'at',
      row: 1,
      col: 2,
      instruction: { opcode: 'SSUB', operands: ['R2', 'R0', 'R1'] }
    });
    expect(conditionalSubCycles[1].statements[0]).toMatchObject({
      instruction: { opcode: 'BSFA', operands: ['R2', 'R0', 'R2', 'SELF'] }
    });

    const carryChainCycles = buildCarryChainCycles(
      {
        srcReg: 'R0',
        carryReg: 'R3',
        storeSymbol: 'L',
        limbs: 2,
        width: 16,
        mask: 65535,
        row: 0,
        startCol: 1,
        direction: 'right'
      },
      80,
      grid,
      span,
      diagnostics
    );
    expect(carryChainCycles).toHaveLength(8);
    expect(carryChainCycles[0].statements[0]).toMatchObject({
      row: 0,
      col: 1,
      instruction: { opcode: 'SADD', operands: ['R0', 'R0', 'R3'] }
    });
    expect(carryChainCycles[2].statements[0]).toMatchObject({
      instruction: { opcode: 'SWI', operands: ['R0', 'L[0]'] }
    });
    expect(carryChainCycles[7].statements[0]).toMatchObject({
      row: 0,
      col: 2,
      instruction: { opcode: 'SRT', operands: ['R3', 'R0', '16'] }
    });

    const badGuardCycles = buildGuardCycles(
      {
        condition: 'col>=',
        opcode: 'SADD',
        destReg: 'R1',
        srcA: 'R0',
        srcB: 'ZERO'
      },
      8,
      grid,
      span,
      diagnostics
    );
    expect(badGuardCycles).toEqual([]);
    expect(diagnostics.some((d) => d.code === ErrorCodes.Parse.InvalidSyntax)).toBe(true);

    const collectCycles = buildCollectCycles(
      {
        from: { axis: 'row', index: 1 },
        to: { axis: 'row', index: 0 },
        viaReg: 'RCB',
        localReg: 'R2',
        destReg: 'R3',
        combine: 'add'
      },
      9,
      grid,
      span,
      diagnostics
    );
    expect(collectCycles).toHaveLength(2);
    expect(collectCycles[0].statements.length).toBe(4);
    expect(collectCycles[1].statements[0]).toMatchObject({
      kind: 'at',
      row: 0,
      col: 0,
      instruction: { opcode: 'SADD', operands: ['R3', 'R2', 'R3'] }
    });

    const collectShiftAddCycles = buildCollectCycles(
      {
        from: { axis: 'row', index: 1 },
        to: { axis: 'row', index: 0 },
        viaReg: 'RCB',
        localReg: 'R2',
        destReg: 'R3',
        combine: 'shift_add'
      },
      11,
      grid,
      span,
      diagnostics
    );
    expect(collectShiftAddCycles).toHaveLength(2);
    expect(collectShiftAddCycles[1].statements[0]).toMatchObject({
      instruction: { operands: ['R3', 'R2', 'ZERO'] }
    });
    expect(collectShiftAddCycles[1].statements[1]).toMatchObject({
      instruction: { operands: ['R3', 'R2', 'RCL'] }
    });

    const badCollectCycles = buildCollectCycles(
      {
        from: { axis: 'row', index: 3 },
        to: { axis: 'row', index: 0 },
        viaReg: 'RCB',
        localReg: 'R2',
        destReg: 'R3',
        combine: 'add'
      },
      13,
      grid,
      span,
      diagnostics
    );
    expect(badCollectCycles).toEqual([]);
    expect(diagnostics.some((d) => d.code === ErrorCodes.Semantic.InvalidCollectPath)).toBe(true);

    const normalizeCycles = buildNormalizeCycles(
      {
        reg: 'R3',
        carryReg: 'R1',
        width: 16,
        mask: 65535,
        axis: 'row',
        lane: 0,
        direction: 'right'
      },
      15,
      grid,
      span,
      diagnostics
    );
    expect(normalizeCycles).toHaveLength(4);
    expect(normalizeCycles[0].statements[0]).toMatchObject({
      kind: 'at',
      row: 0,
      col: 0,
      instruction: { opcode: 'SRT', operands: ['R1', 'R3', '16'] }
    });
    expect(normalizeCycles[3].statements[0]).toMatchObject({
      instruction: { opcode: 'SADD', operands: ['R3', 'R3', 'ZERO'] }
    });

    const badNormalize = buildNormalizeCycles(
      {
        reg: 'R3',
        carryReg: 'R1',
        width: 40,
        mask: 65535,
        axis: 'row',
        lane: 0,
        direction: 'right'
      },
      19,
      grid,
      span,
      diagnostics
    );
    expect(badNormalize).toEqual([]);
    expect(diagnostics.some((d) => d.code === ErrorCodes.Semantic.UnsupportedOperation)).toBe(true);

    const extractBytesCycles = buildExtractBytesCycles(
      {
        srcReg: 'R0',
        destReg: 'R1',
        axis: 'col',
        byteWidth: 8,
        mask: 255
      },
      20,
      grid,
      span,
      diagnostics
    );
    expect(extractBytesCycles).toHaveLength(2);
    expect(extractBytesCycles[0].statements[0]).toMatchObject({
      instruction: { opcode: 'SRT', operands: ['R1', 'R0', '0'] }
    });
    expect(extractBytesCycles[0].statements[1]).toMatchObject({
      instruction: { opcode: 'SRT', operands: ['R1', 'R0', '8'] }
    });
    expect(extractBytesCycles[1].statements[0]).toMatchObject({
      instruction: { opcode: 'LAND', operands: ['R1', 'R1', '255'] }
    });

    const badExtractBytes = buildExtractBytesCycles(
      {
        srcReg: 'R0',
        destReg: 'R1',
        axis: 'row',
        byteWidth: 32,
        mask: 255
      },
      22,
      grid,
      span,
      diagnostics
    );
    expect(badExtractBytes).toEqual([]);
    expect(diagnostics.some((d) => d.code === ErrorCodes.Semantic.UnsupportedOperation)).toBe(true);
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
