import { describe, expect, it } from 'vitest';
import { ErrorCodes, spanAt } from '@openedge/compiler-ir';
import {
  buildAccumulateCycles,
  buildAllreduceCycles,
  buildCollectCycles,
  buildExtractBytesCycles,
  buildGatherCycles,
  buildNormalizeCycles,
  buildStencilCycles,
  buildStreamCycles,
  buildTransposeCycles
} from '../packages/compiler-api/src/passes-shared/collective-builders.js';
import {
  buildBroadcastCycles,
  buildRotateShiftCycles
} from '../packages/compiler-api/src/passes-shared/route-builders.js';

const span = spanAt(1, 1, 1);

const torusGrid: any = {
  rows: 4,
  cols: 4,
  topology: 'torus',
  wrapPolicy: 'wrap'
};

const meshGrid: any = {
  rows: 4,
  cols: 4,
  topology: 'mesh',
  wrapPolicy: 'clamp'
};

describe('compiler-api collective/route builders', () => {
  it('builds allreduce cycles and composes reduce + broadcast', () => {
    const diagnostics: any[] = [];
    const cycles = buildAllreduceCycles(
      {
        operation: 'add',
        destReg: 'R1',
        srcReg: 'R0',
        axis: 'row'
      },
      3,
      torusGrid,
      span,
      diagnostics
    );

    expect(diagnostics).toHaveLength(0);
    expect(cycles.length).toBeGreaterThan(0);
    expect(cycles[0].index).toBe(3);
    const opcodes = cycles.flatMap((cycle) =>
      cycle.statements.flatMap((stmt) => stmt.kind === 'row' ? stmt.instructions.map((inst) => inst.opcode) : [stmt.instruction.opcode])
    );
    expect(opcodes).toContain('SADD');
  });

  it('builds stencil cycles for cross pattern and rejects unsupported operation', () => {
    const okDiagnostics: any[] = [];
    const okCycles = buildStencilCycles(
      {
        pattern: 'cross',
        operation: 'add',
        srcReg: 'R0',
        destReg: 'R1'
      },
      0,
      torusGrid,
      span,
      okDiagnostics
    );
    expect(okDiagnostics).toHaveLength(0);
    expect(okCycles).toHaveLength(4);
    expect(okCycles[0].statements).toHaveLength(torusGrid.rows * torusGrid.cols);

    const badDiagnostics: any[] = [];
    const badCycles = buildStencilCycles(
      {
        pattern: 'vertical',
        operation: 'mul',
        srcReg: 'R0',
        destReg: 'R1'
      },
      0,
      torusGrid,
      span,
      badDiagnostics
    );
    expect(badCycles).toHaveLength(0);
    expect(badDiagnostics.some((d) => d.code === ErrorCodes.Semantic.UnsupportedOperation)).toBe(true);
  });

  it('validates transpose constraints and emits cycles on square grid', () => {
    const nonSquareDiagnostics: any[] = [];
    const nonSquareCycles = buildTransposeCycles(
      { reg: 'R0' },
      0,
      { ...torusGrid, rows: 2, cols: 3 },
      span,
      nonSquareDiagnostics
    );
    expect(nonSquareCycles).toHaveLength(0);
    expect(nonSquareDiagnostics.some((d) => d.code === ErrorCodes.Semantic.UnsupportedOperation)).toBe(true);

    const squareDiagnostics: any[] = [];
    const squareCycles = buildTransposeCycles(
      { reg: 'R0' },
      4,
      torusGrid,
      span,
      squareDiagnostics
    );
    expect(squareDiagnostics).toHaveLength(0);
    expect(squareCycles.length).toBeGreaterThan(0);
    expect(squareCycles[0].index).toBe(4);
  });

  it('validates gather destination/op and builds gather sequence', () => {
    const badDstDiagnostics: any[] = [];
    const badDstCycles = buildGatherCycles(
      {
        srcReg: 'R0',
        dest: { row: 9, col: 9 },
        destReg: 'R1',
        operation: 'add'
      },
      0,
      torusGrid,
      span,
      badDstDiagnostics
    );
    expect(badDstCycles).toHaveLength(0);
    expect(badDstDiagnostics.some((d) => d.code === ErrorCodes.Semantic.CoordinateOutOfBounds)).toBe(true);

    const badOpDiagnostics: any[] = [];
    const badOpCycles = buildGatherCycles(
      {
        srcReg: 'R0',
        dest: { row: 0, col: 0 },
        destReg: 'R1',
        operation: 'max'
      },
      0,
      torusGrid,
      span,
      badOpDiagnostics
    );
    expect(badOpCycles).toHaveLength(0);
    expect(badOpDiagnostics.some((d) => d.code === ErrorCodes.Semantic.UnsupportedOperation)).toBe(true);

    const okDiagnostics: any[] = [];
    const okCycles = buildGatherCycles(
      {
        srcReg: 'R0',
        dest: { row: 0, col: 0 },
        destReg: 'R1',
        operation: 'add'
      },
      2,
      torusGrid,
      span,
      okDiagnostics
    );
    expect(okDiagnostics).toHaveLength(0);
    expect(okCycles.length).toBeGreaterThan(1);
    expect(okCycles[0].index).toBe(2);
    const firstStmt: any = okCycles[0].statements[0];
    expect(firstStmt.instruction.text).toContain('SADD R1, R0, ZERO');
  });

  it('validates stream row/count and builds row cycles', () => {
    const badRowDiagnostics: any[] = [];
    const badRowCycles = buildStreamCycles('LWD', 'R1', 9, 2, 0, torusGrid, span, badRowDiagnostics);
    expect(badRowCycles).toHaveLength(0);
    expect(badRowDiagnostics.some((d) => d.code === ErrorCodes.Semantic.CoordinateOutOfBounds)).toBe(true);

    const badCountDiagnostics: any[] = [];
    const badCountCycles = buildStreamCycles('SWD', 'R2', 0, 0, 0, torusGrid, span, badCountDiagnostics);
    expect(badCountCycles).toHaveLength(0);
    expect(badCountDiagnostics.some((d) => d.code === ErrorCodes.Semantic.UnsupportedOperation)).toBe(true);

    const okDiagnostics: any[] = [];
    const okCycles = buildStreamCycles('LWD', 'R1', 1, 3, 5, torusGrid, span, okDiagnostics);
    expect(okDiagnostics).toHaveLength(0);
    expect(okCycles).toHaveLength(3);
    expect(okCycles[0].index).toBe(5);
    expect(okCycles[0].statements[0].kind).toBe('row');
  });

  it('builds broadcast and rotate/shift route cycles', () => {
    const broadcastDiagnostics: any[] = [];
    const broadcastCycles = buildBroadcastCycles(
      {
        valueReg: 'R1',
        from: { row: 0, col: 0 },
        scope: 'all'
      },
      0,
      torusGrid,
      span,
      broadcastDiagnostics
    );
    expect(broadcastDiagnostics).toHaveLength(0);
    expect(broadcastCycles.length).toBeGreaterThan(0);

    const rotateMeshDiagnostics: any[] = [];
    const rotateMeshCycles = buildRotateShiftCycles(
      {
        reg: 'R0',
        direction: 'left',
        distance: 1
      },
      false,
      0,
      meshGrid,
      span,
      rotateMeshDiagnostics
    );
    expect(rotateMeshCycles).toHaveLength(0);
    expect(rotateMeshDiagnostics.some((d) => d.code === ErrorCodes.Semantic.UnsupportedOperation)).toBe(true);

    const shiftDiagnostics: any[] = [];
    const shiftCycles = buildRotateShiftCycles(
      {
        reg: 'R0',
        direction: 'right',
        distance: 2,
        fill: 7
      },
      true,
      10,
      meshGrid,
      span,
      shiftDiagnostics
    );
    expect(shiftDiagnostics).toHaveLength(0);
    expect(shiftCycles).toHaveLength(4);
    expect(shiftCycles[0].index).toBe(10);
    const hasFill = shiftCycles.some((cycle) =>
      cycle.statements.some((stmt) => stmt.kind === 'at' && stmt.instruction.text.includes('IMM(7)'))
    );
    expect(hasFill).toBe(true);
  });

  it('builds collect cycles and validates collect constraints', () => {
    const okDiagnostics: any[] = [];
    const okCycles = buildCollectCycles(
      {
        from: { axis: 'row', index: 1 },
        to: { axis: 'row', index: 0 },
        viaReg: 'RCB',
        localReg: 'R2',
        destReg: 'R3',
        combine: 'shift_add'
      },
      6,
      torusGrid,
      span,
      okDiagnostics
    );
    expect(okDiagnostics).toHaveLength(0);
    expect(okCycles).toHaveLength(2);
    expect(okCycles[0].index).toBe(6);
    const secondCycleStatements: any[] = okCycles[1].statements as any[];
    expect(secondCycleStatements[0].instruction.operands).toEqual(['R3', 'R2', 'ZERO']);
    expect(secondCycleStatements[1].instruction.operands).toEqual(['R3', 'R2', 'RCL']);

    const badViaDiagnostics: any[] = [];
    const badViaCycles = buildCollectCycles(
      {
        from: { axis: 'row', index: 1 },
        to: { axis: 'row', index: 0 },
        viaReg: 'RCR',
        localReg: 'R2',
        destReg: 'R3',
        combine: 'add'
      },
      0,
      torusGrid,
      span,
      badViaDiagnostics
    );
    expect(badViaCycles).toHaveLength(0);
    expect(badViaDiagnostics.some((d) => d.code === ErrorCodes.Semantic.UnsupportedOperation)).toBe(true);

    const copyDiagnostics: any[] = [];
    const copyCycles = buildCollectCycles(
      {
        from: { axis: 'row', index: 0 },
        to: { axis: 'row', index: 0 },
        viaReg: 'SELF',
        localReg: 'R2',
        destReg: 'R3',
        combine: 'copy'
      },
      0,
      torusGrid,
      span,
      copyDiagnostics
    );
    expect(copyDiagnostics).toHaveLength(0);
    expect(copyCycles).toHaveLength(1);

    const colShiftDiagnostics: any[] = [];
    const colShiftCycles = buildCollectCycles(
      {
        from: { axis: 'col', index: 1 },
        to: { axis: 'col', index: 0 },
        viaReg: 'RCR',
        localReg: 'R2',
        destReg: 'R3',
        combine: 'shift_add'
      },
      0,
      torusGrid,
      span,
      colShiftDiagnostics
    );
    expect(colShiftDiagnostics).toHaveLength(0);
    expect(colShiftCycles).toHaveLength(2);
    const colShiftSecond: any[] = colShiftCycles[1].statements as any[];
    expect(colShiftSecond[0].instruction.operands).toEqual(['R3', 'R2', 'ZERO']);
    expect(colShiftSecond[1].instruction.operands).toEqual(['R3', 'R2', 'RCT']);

    const rowReverseDiagnostics: any[] = [];
    const rowReverseCycles = buildCollectCycles(
      {
        from: { axis: 'row', index: 0 },
        to: { axis: 'row', index: 1 },
        viaReg: 'RCT',
        localReg: 'R2',
        destReg: 'R3',
        combine: 'add'
      },
      0,
      torusGrid,
      span,
      rowReverseDiagnostics
    );
    expect(rowReverseDiagnostics).toHaveLength(0);
    expect(rowReverseCycles).toHaveLength(2);

    const colForwardDiagnostics: any[] = [];
    const colForwardCycles = buildCollectCycles(
      {
        from: { axis: 'col', index: 0 },
        to: { axis: 'col', index: 1 },
        viaReg: 'RCL',
        localReg: 'R2',
        destReg: 'R3',
        combine: 'add'
      },
      0,
      torusGrid,
      span,
      colForwardDiagnostics
    );
    expect(colForwardDiagnostics).toHaveLength(0);
    expect(colForwardCycles).toHaveLength(2);

    const zeroLaneDiagnostics: any[] = [];
    const zeroLaneCycles = buildCollectCycles(
      {
        from: { axis: 'row', index: 1 },
        to: { axis: 'row', index: 1 },
        viaReg: 'SELF',
        localReg: 'R2',
        destReg: 'R3',
        combine: 'add'
      },
      0,
      { rows: 2, cols: 0, topology: 'mesh', wrapPolicy: 'clamp' },
      span,
      zeroLaneDiagnostics
    );
    expect(zeroLaneDiagnostics).toHaveLength(0);
    expect(zeroLaneCycles).toHaveLength(0);

    const badCombineDiagnostics: any[] = [];
    const badCombineCycles = buildCollectCycles(
      {
        from: { axis: 'row', index: 1 },
        to: { axis: 'row', index: 0 },
        viaReg: 'RCB',
        localReg: 'R2',
        destReg: 'R3',
        combine: 'invalid' as any
      },
      0,
      torusGrid,
      span,
      badCombineDiagnostics
    );
    expect(badCombineCycles).toHaveLength(0);
    expect(badCombineDiagnostics.some((d) => d.code === ErrorCodes.Semantic.UnsupportedOperation)).toBe(true);

    const invalidViaDiagnostics: any[] = [];
    const invalidViaCycles = buildCollectCycles(
      {
        from: { axis: 'row', index: 1 },
        to: { axis: 'row', index: 0 },
        viaReg: 'RZ',
        localReg: 'R2',
        destReg: 'R3',
        combine: 'add'
      },
      0,
      torusGrid,
      span,
      invalidViaDiagnostics
    );
    expect(invalidViaCycles).toHaveLength(0);
    expect(invalidViaDiagnostics.some((d) => d.code === ErrorCodes.Semantic.UnsupportedOperation)).toBe(true);

    const rowBoundsDiagnostics: any[] = [];
    const rowBoundsCycles = buildCollectCycles(
      {
        from: { axis: 'row', index: 9 },
        to: { axis: 'row', index: 0 },
        viaReg: 'SELF',
        localReg: 'R2',
        destReg: 'R3',
        combine: 'copy'
      },
      0,
      torusGrid,
      span,
      rowBoundsDiagnostics
    );
    expect(rowBoundsCycles).toHaveLength(0);
    expect(rowBoundsDiagnostics.some((d) => d.code === ErrorCodes.Semantic.CoordinateOutOfBounds)).toBe(true);

    const colNonAdjacentDiagnostics: any[] = [];
    const colNonAdjacentCycles = buildCollectCycles(
      {
        from: { axis: 'col', index: 3 },
        to: { axis: 'col', index: 0 },
        viaReg: 'RCR',
        localReg: 'R2',
        destReg: 'R3',
        combine: 'add'
      },
      0,
      torusGrid,
      span,
      colNonAdjacentDiagnostics
    );
    expect(colNonAdjacentCycles).toHaveLength(0);
    expect(colNonAdjacentDiagnostics.some((d) => d.code === ErrorCodes.Semantic.UnsupportedOperation)).toBe(true);

    const badBoundsDiagnostics: any[] = [];
    const badBoundsCycles = buildCollectCycles(
      {
        from: { axis: 'col', index: 9 },
        to: { axis: 'col', index: 0 },
        viaReg: 'SELF',
        localReg: 'R2',
        destReg: 'R3',
        combine: 'copy'
      },
      0,
      torusGrid,
      span,
      badBoundsDiagnostics
    );
    expect(badBoundsCycles).toHaveLength(0);
    expect(badBoundsDiagnostics.some((d) => d.code === ErrorCodes.Semantic.CoordinateOutOfBounds)).toBe(true);
  });

  it('builds accumulate cycles for row/col/anti_diagonal patterns', () => {
    const antiDiagDiagnostics: any[] = [];
    const antiDiagCycles = buildAccumulateCycles(
      {
        pattern: 'anti_diagonal',
        productsReg: 'R2',
        accumReg: 'R3',
        outReg: 'ROUT',
        combine: 'add'
      },
      4,
      torusGrid,
      span,
      antiDiagDiagnostics
    );
    expect(antiDiagDiagnostics).toHaveLength(0);
    expect(antiDiagCycles).toHaveLength(4);
    expect(antiDiagCycles[0].index).toBe(4);
    expect(antiDiagCycles[1].statements[0]).toMatchObject({
      row: 0,
      col: 0,
      instruction: { operands: ['R3', 'R3', 'ZERO'] }
    });
    expect(antiDiagCycles[1].statements[5]).toMatchObject({
      row: 1,
      col: 1,
      instruction: { operands: ['R3', 'R3', 'RCT'] }
    });
    expect(antiDiagCycles[2].statements[0]).toMatchObject({
      row: 0,
      col: 0,
      instruction: { operands: ['R3', 'R3', 'RCR'] }
    });
    expect(antiDiagCycles[3].statements[0]).toMatchObject({
      instruction: { operands: ['ROUT', 'R3', 'ZERO'] }
    });

    const rowDiagnostics: any[] = [];
    const rowCycles = buildAccumulateCycles(
      {
        pattern: 'row',
        productsReg: 'R0',
        accumReg: 'R1',
        outReg: 'R2',
        combine: 'xor'
      },
      0,
      torusGrid,
      span,
      rowDiagnostics
    );
    expect(rowDiagnostics).toHaveLength(0);
    expect(rowCycles).toHaveLength(3);
    expect(rowCycles[1].statements[0]).toMatchObject({
      instruction: { opcode: 'LXOR', operands: ['R1', 'R1', 'ZERO'] }
    });
    expect(rowCycles[1].statements[1]).toMatchObject({
      instruction: { opcode: 'LXOR', operands: ['R1', 'R1', 'RCL'] }
    });

    const colDiagnostics: any[] = [];
    const colCycles = buildAccumulateCycles(
      {
        pattern: 'col',
        productsReg: 'R0',
        accumReg: 'R1',
        outReg: 'R2',
        combine: 'sub'
      },
      0,
      torusGrid,
      span,
      colDiagnostics
    );
    expect(colDiagnostics).toHaveLength(0);
    expect(colCycles).toHaveLength(3);
    expect(colCycles[1].statements[0]).toMatchObject({
      instruction: { opcode: 'SSUB', operands: ['R1', 'R1', 'ZERO'] }
    });
    expect(colCycles[1].statements[4]).toMatchObject({
      instruction: { opcode: 'SSUB', operands: ['R1', 'R1', 'RCT'] }
    });

    const badCombineDiagnostics: any[] = [];
    const badCombineCycles = buildAccumulateCycles(
      {
        pattern: 'row',
        productsReg: 'R0',
        accumReg: 'R1',
        outReg: 'R2',
        combine: 'bad' as any
      },
      0,
      torusGrid,
      span,
      badCombineDiagnostics
    );
    expect(badCombineCycles).toHaveLength(0);
    expect(badCombineDiagnostics.some((d) => d.code === ErrorCodes.Semantic.UnsupportedOperation)).toBe(true);

    const badPatternDiagnostics: any[] = [];
    const badPatternCycles = buildAccumulateCycles(
      {
        pattern: 'diag' as any,
        productsReg: 'R0',
        accumReg: 'R1',
        outReg: 'R2',
        combine: 'add'
      },
      0,
      torusGrid,
      span,
      badPatternDiagnostics
    );
    expect(badPatternCycles).toHaveLength(0);
    expect(badPatternDiagnostics.some((d) => d.code === ErrorCodes.Semantic.UnsupportedOperation)).toBe(true);
  });

  it('builds normalize cycles and validates lane/width constraints', () => {
    const rowDiagnostics: any[] = [];
    const rowCycles = buildNormalizeCycles(
      {
        reg: 'R3',
        carryReg: 'R1',
        width: 16,
        mask: 65535,
        axis: 'row',
        lane: 0,
        direction: 'right'
      },
      2,
      torusGrid,
      span,
      rowDiagnostics
    );
    expect(rowDiagnostics).toHaveLength(0);
    expect(rowCycles).toHaveLength(4);
    expect(rowCycles[0].index).toBe(2);
    const rowAddOperands: any[] = (rowCycles[3].statements as any[]).map((stmt) => stmt.instruction.operands);
    expect(rowAddOperands[0]).toEqual(['R3', 'R3', 'ZERO']);
    expect(rowAddOperands[1]).toEqual(['R3', 'R3', 'RCL']);

    const colDiagnostics: any[] = [];
    const colCycles = buildNormalizeCycles(
      {
        reg: 'R2',
        carryReg: 'R0',
        width: 8,
        mask: 255,
        axis: 'col',
        lane: 1,
        direction: 'up'
      },
      0,
      torusGrid,
      span,
      colDiagnostics
    );
    expect(colDiagnostics).toHaveLength(0);
    expect(colCycles).toHaveLength(4);
    const colAddOperands: any[] = (colCycles[3].statements as any[]).map((stmt) => stmt.instruction.operands);
    expect(colAddOperands[0]).toEqual(['R2', 'R2', 'ZERO']);
    expect(colAddOperands[1]).toEqual(['R2', 'R2', 'RCB']);

    const rowLeftDiagnostics: any[] = [];
    const rowLeftCycles = buildNormalizeCycles(
      {
        reg: 'R3',
        carryReg: 'R1',
        width: 8,
        mask: 255,
        axis: 'row',
        lane: 0,
        direction: 'left'
      },
      0,
      torusGrid,
      span,
      rowLeftDiagnostics
    );
    expect(rowLeftDiagnostics).toHaveLength(0);
    const rowLeftAddOperands: any[] = (rowLeftCycles[3].statements as any[]).map((stmt) => stmt.instruction.operands);
    expect(rowLeftAddOperands[0]).toEqual(['R3', 'R3', 'ZERO']);
    expect(rowLeftAddOperands[1]).toEqual(['R3', 'R3', 'RCR']);

    const colDownDiagnostics: any[] = [];
    const colDownCycles = buildNormalizeCycles(
      {
        reg: 'R2',
        carryReg: 'R0',
        width: 8,
        mask: 255,
        axis: 'col',
        lane: 1,
        direction: 'down'
      },
      0,
      torusGrid,
      span,
      colDownDiagnostics
    );
    expect(colDownDiagnostics).toHaveLength(0);
    const colDownAddOperands: any[] = (colDownCycles[3].statements as any[]).map((stmt) => stmt.instruction.operands);
    expect(colDownAddOperands[0]).toEqual(['R2', 'R2', 'ZERO']);
    expect(colDownAddOperands[1]).toEqual(['R2', 'R2', 'RCT']);

    const badWidthDiagnostics: any[] = [];
    const badWidthCycles = buildNormalizeCycles(
      {
        reg: 'R3',
        carryReg: 'R1',
        width: 0,
        mask: 0,
        axis: 'row',
        lane: 0,
        direction: 'right'
      },
      0,
      torusGrid,
      span,
      badWidthDiagnostics
    );
    expect(badWidthCycles).toHaveLength(0);
    expect(badWidthDiagnostics.some((d) => d.code === ErrorCodes.Semantic.UnsupportedOperation)).toBe(true);

    const badLaneDiagnostics: any[] = [];
    const badLaneCycles = buildNormalizeCycles(
      {
        reg: 'R3',
        carryReg: 'R1',
        width: 8,
        mask: 255,
        axis: 'col',
        lane: 9,
        direction: 'down'
      },
      0,
      torusGrid,
      span,
      badLaneDiagnostics
    );
    expect(badLaneCycles).toHaveLength(0);
    expect(badLaneDiagnostics.some((d) => d.code === ErrorCodes.Semantic.CoordinateOutOfBounds)).toBe(true);

    const zeroLengthDiagnostics: any[] = [];
    const zeroLengthCycles = buildNormalizeCycles(
      {
        reg: 'R3',
        carryReg: 'R1',
        width: 8,
        mask: 255,
        axis: 'row',
        lane: 0,
        direction: 'left'
      },
      0,
      { rows: 2, cols: 0, topology: 'mesh', wrapPolicy: 'clamp' },
      span,
      zeroLengthDiagnostics
    );
    expect(zeroLengthDiagnostics).toHaveLength(0);
    expect(zeroLengthCycles).toHaveLength(0);
  });

  it('builds extract_bytes cycles and validates byte width constraints', () => {
    const okDiagnostics: any[] = [];
    const okCycles = buildExtractBytesCycles(
      {
        srcReg: 'R0',
        destReg: 'R1',
        axis: 'row',
        byteWidth: 8,
        mask: 255
      },
      4,
      torusGrid,
      span,
      okDiagnostics
    );
    expect(okDiagnostics).toHaveLength(0);
    expect(okCycles).toHaveLength(2);
    expect(okCycles[0].index).toBe(4);
    expect(okCycles[0].statements[0]).toMatchObject({
      row: 0,
      col: 0,
      instruction: { operands: ['R1', 'R0', '0'] }
    });
    expect(okCycles[0].statements[4]).toMatchObject({
      row: 1,
      col: 0,
      instruction: { operands: ['R1', 'R0', '8'] }
    });
    expect(okCycles[1].statements[0]).toMatchObject({
      instruction: { opcode: 'LAND', operands: ['R1', 'R1', '255'] }
    });

    const badWidthDiagnostics: any[] = [];
    const badWidthCycles = buildExtractBytesCycles(
      {
        srcReg: 'R0',
        destReg: 'R1',
        axis: 'col',
        byteWidth: 0,
        mask: 255
      },
      0,
      torusGrid,
      span,
      badWidthDiagnostics
    );
    expect(badWidthCycles).toHaveLength(0);
    expect(badWidthDiagnostics.some((d) => d.code === ErrorCodes.Semantic.UnsupportedOperation)).toBe(true);

    const zeroGridDiagnostics: any[] = [];
    const zeroGridCycles = buildExtractBytesCycles(
      {
        srcReg: 'R0',
        destReg: 'R1',
        axis: 'col',
        byteWidth: 8,
        mask: 255
      },
      0,
      { rows: 0, cols: 4, topology: 'mesh', wrapPolicy: 'clamp' },
      span,
      zeroGridDiagnostics
    );
    expect(zeroGridDiagnostics).toHaveLength(0);
    expect(zeroGridCycles).toHaveLength(0);
  });
});
