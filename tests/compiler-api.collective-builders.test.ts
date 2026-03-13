import { describe, expect, it } from 'vitest';
import { ErrorCodes, spanAt } from '@castm/compiler-ir';
import {
  buildAccumulateCycles,
  buildAllreduceCycles,
  buildCarryChainCycles,
  buildCollectCycles,
  buildConditionalSubCycles,
  buildExtractBytesCycles,
  buildGatherCycles,
  buildMulaccChainCycles,
  buildNormalizeCycles,
  buildStashCycles,
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
      cycle.statements.some((stmt) => stmt.kind === 'at' && stmt.instruction.text.includes('ZERO, 7'))
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
    expect(colNonAdjacentDiagnostics.some((d) => d.code === ErrorCodes.Semantic.InvalidCollectPath)).toBe(true);

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
        combine: 'add',
        steps: 1
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
        combine: 'xor',
        steps: 1
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
        combine: 'sub',
        steps: 1
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
        combine: 'bad' as any,
        steps: 1
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
        combine: 'add',
        steps: 1
      },
      0,
      torusGrid,
      span,
      badPatternDiagnostics
    );
    expect(badPatternCycles).toHaveLength(0);
    expect(badPatternDiagnostics.some((d) => d.code === ErrorCodes.Semantic.UnsupportedOperation)).toBe(true);

    const steppedDiagnostics: any[] = [];
    const steppedCycles = buildAccumulateCycles(
      {
        pattern: 'row',
        productsReg: 'R0',
        accumReg: 'R1',
        outReg: 'R2',
        combine: 'add',
        steps: 2
      },
      0,
      { rows: 2, cols: 4, topology: 'mesh', wrapPolicy: 'clamp' },
      span,
      steppedDiagnostics
    );
    expect(steppedDiagnostics).toHaveLength(0);
    expect(steppedCycles).toHaveLength(4); // seed + 2 row passes + final
    expect(steppedCycles[1].statements[1]).toMatchObject({
      instruction: { opcode: 'SADD', operands: ['R1', 'R1', 'RCL'] }
    });
    expect(steppedCycles[2].statements[1]).toMatchObject({
      instruction: { opcode: 'SADD', operands: ['R1', 'R1', 'RCL'] }
    });

    const optimizedDiagnostics: any[] = [];
    const optimizedCycles = buildAccumulateCycles(
      {
        pattern: 'row',
        productsReg: 'R1',
        accumReg: 'R1',
        outReg: 'R1',
        combine: 'add',
        steps: 1
      },
      0,
      torusGrid,
      span,
      optimizedDiagnostics
    );
    expect(optimizedDiagnostics).toHaveLength(0);
    expect(optimizedCycles).toHaveLength(1); // only combine stage remains

    const tooDeepDiagnostics: any[] = [];
    const tooDeepCycles = buildAccumulateCycles(
      {
        pattern: 'row',
        productsReg: 'R0',
        accumReg: 'R1',
        outReg: 'R2',
        combine: 'add',
        steps: 9
      },
      0,
      torusGrid,
      span,
      tooDeepDiagnostics
    );
    expect(tooDeepCycles).toHaveLength(0);
    expect(tooDeepDiagnostics.some((d) => d.code === ErrorCodes.Semantic.UnsupportedOperation)).toBe(true);

    const scopedRowDiagnostics: any[] = [];
    const scopedRowCycles = buildAccumulateCycles(
      {
        pattern: 'row',
        productsReg: 'R0',
        accumReg: 'R1',
        outReg: 'R2',
        combine: 'add',
        steps: 1,
        scope: { kind: 'row', index: 2 }
      },
      0,
      torusGrid,
      span,
      scopedRowDiagnostics
    );
    expect(scopedRowDiagnostics).toHaveLength(0);
    expect(scopedRowCycles).toHaveLength(3);
    expect(scopedRowCycles[0].statements).toHaveLength(4);
    expect(scopedRowCycles[1].statements.every((s: any) => s.row === 2)).toBe(true);

    const scopedColDiagnostics: any[] = [];
    const scopedColCycles = buildAccumulateCycles(
      {
        pattern: 'col',
        productsReg: 'R0',
        accumReg: 'R1',
        outReg: 'R2',
        combine: 'add',
        steps: 1,
        scope: { kind: 'col', index: 1 }
      },
      0,
      torusGrid,
      span,
      scopedColDiagnostics
    );
    expect(scopedColDiagnostics).toHaveLength(0);
    expect(scopedColCycles).toHaveLength(3);
    expect(scopedColCycles[0].statements).toHaveLength(4);
    expect(scopedColCycles[1].statements.every((s: any) => s.col === 1)).toBe(true);

    const scopedMismatchDiagnostics: any[] = [];
    const scopedMismatchCycles = buildAccumulateCycles(
      {
        pattern: 'anti_diagonal',
        productsReg: 'R0',
        accumReg: 'R1',
        outReg: 'R2',
        combine: 'add',
        steps: 1,
        scope: { kind: 'row', index: 0 }
      },
      0,
      torusGrid,
      span,
      scopedMismatchDiagnostics
    );
    expect(scopedMismatchCycles).toHaveLength(0);
    expect(scopedMismatchDiagnostics.some((d) => d.code === ErrorCodes.Semantic.UnsupportedOperation)).toBe(true);

    const outOfBoundsScopeDiagnostics: any[] = [];
    const outOfBoundsScopeCycles = buildAccumulateCycles(
      {
        pattern: 'row',
        productsReg: 'R0',
        accumReg: 'R1',
        outReg: 'R2',
        combine: 'add',
        steps: 1,
        scope: { kind: 'row', index: 9 }
      },
      0,
      torusGrid,
      span,
      outOfBoundsScopeDiagnostics
    );
    expect(outOfBoundsScopeCycles).toHaveLength(0);
    expect(outOfBoundsScopeDiagnostics.some((d) => d.code === ErrorCodes.Semantic.CoordinateOutOfBounds)).toBe(true);
  });

  it('builds conditional_sub cycles and validates spatial targets', () => {
    const allDiagnostics: any[] = [];
    const allCycles = buildConditionalSubCycles(
      {
        valueReg: 'R0',
        subReg: 'R1',
        destReg: 'R2',
        target: { kind: 'all' }
      },
      9,
      torusGrid,
      span,
      allDiagnostics
    );
    expect(allDiagnostics).toHaveLength(0);
    expect(allCycles).toHaveLength(2);
    expect(allCycles[0].index).toBe(9);
    expect(allCycles[0].statements).toHaveLength(16);
    expect(allCycles[1].statements[0]).toMatchObject({
      instruction: { opcode: 'BSFA', operands: ['R2', 'R0', 'R2', 'SELF'] }
    });

    const rowDiagnostics: any[] = [];
    const rowCycles = buildConditionalSubCycles(
      {
        valueReg: 'R3',
        subReg: 'R4',
        destReg: 'R5',
        target: { kind: 'row', index: 2 }
      },
      0,
      torusGrid,
      span,
      rowDiagnostics
    );
    expect(rowDiagnostics).toHaveLength(0);
    expect(rowCycles[0].statements).toHaveLength(4);
    expect(rowCycles[0].statements[0]).toMatchObject({ row: 2, col: 0 });

    const colDiagnostics: any[] = [];
    const colCycles = buildConditionalSubCycles(
      {
        valueReg: 'R3',
        subReg: 'R4',
        destReg: 'R5',
        target: { kind: 'col', index: 1 }
      },
      0,
      torusGrid,
      span,
      colDiagnostics
    );
    expect(colDiagnostics).toHaveLength(0);
    expect(colCycles[0].statements).toHaveLength(4);
    expect(colCycles[0].statements[0]).toMatchObject({ row: 0, col: 1 });

    const pointDiagnostics: any[] = [];
    const pointCycles = buildConditionalSubCycles(
      {
        valueReg: 'R7',
        subReg: 'R1',
        destReg: 'R0',
        target: { kind: 'point', row: 1, col: 3 }
      },
      0,
      torusGrid,
      span,
      pointDiagnostics
    );
    expect(pointDiagnostics).toHaveLength(0);
    expect(pointCycles[0].statements).toHaveLength(1);
    expect(pointCycles[0].statements[0]).toMatchObject({ row: 1, col: 3 });

    const badRowDiagnostics: any[] = [];
    const badRowCycles = buildConditionalSubCycles(
      {
        valueReg: 'R0',
        subReg: 'R1',
        destReg: 'R2',
        target: { kind: 'row', index: 99 }
      },
      0,
      torusGrid,
      span,
      badRowDiagnostics
    );
    expect(badRowCycles).toHaveLength(0);
    expect(badRowDiagnostics.some((d) => d.code === ErrorCodes.Semantic.CoordinateOutOfBounds)).toBe(true);

    const badPointDiagnostics: any[] = [];
    const badPointCycles = buildConditionalSubCycles(
      {
        valueReg: 'R0',
        subReg: 'R1',
        destReg: 'R2',
        target: { kind: 'point', row: 9, col: 9 }
      },
      0,
      torusGrid,
      span,
      badPointDiagnostics
    );
    expect(badPointCycles).toHaveLength(0);
    expect(badPointDiagnostics.some((d) => d.code === ErrorCodes.Semantic.CoordinateOutOfBounds)).toBe(true);
  });

  it('builds carry_chain cycles and validates geometry bounds', () => {
    const okDiagnostics: any[] = [];
    const okCycles = buildCarryChainCycles(
      {
        srcReg: 'R0',
        carryReg: 'R3',
        storeSymbol: 'L',
        limbs: 3,
        width: 16,
        mask: 65535,
        row: 0,
        startCol: 0,
        direction: 'right'
      },
      0,
      torusGrid,
      span,
      okDiagnostics
    );
    expect(okDiagnostics).toHaveLength(0);
    expect(okCycles).toHaveLength(12);
    expect(okCycles[0].statements[0]).toMatchObject({
      instruction: { opcode: 'SADD', operands: ['R0', 'R0', 'R3'] }
    });
    expect(okCycles[2].statements[0]).toMatchObject({
      instruction: { opcode: 'SWI', operands: ['R0', 'L[0]'] }
    });
    expect(okCycles[11].statements[0]).toMatchObject({
      instruction: { opcode: 'SRT', operands: ['R3', 'R0', '16'] }
    });

    const leftDiagnostics: any[] = [];
    const leftCycles = buildCarryChainCycles(
      {
        srcReg: 'R4',
        carryReg: 'R5',
        storeSymbol: 'M',
        limbs: 2,
        width: 8,
        mask: 255,
        row: 1,
        startCol: 3,
        direction: 'left'
      },
      0,
      torusGrid,
      span,
      leftDiagnostics
    );
    expect(leftDiagnostics).toHaveLength(0);
    expect(leftCycles).toHaveLength(8);
    expect(leftCycles[4].statements[0]).toMatchObject({ row: 1, col: 2 });

    const badRowDiagnostics: any[] = [];
    const badRowCycles = buildCarryChainCycles(
      {
        srcReg: 'R0',
        carryReg: 'R3',
        storeSymbol: 'L',
        limbs: 2,
        width: 16,
        mask: 65535,
        row: 9,
        startCol: 0,
        direction: 'right'
      },
      0,
      torusGrid,
      span,
      badRowDiagnostics
    );
    expect(badRowCycles).toHaveLength(0);
    expect(badRowDiagnostics.some((d) => d.code === ErrorCodes.Semantic.CoordinateOutOfBounds)).toBe(true);

    const badColDiagnostics: any[] = [];
    const badColCycles = buildCarryChainCycles(
      {
        srcReg: 'R0',
        carryReg: 'R3',
        storeSymbol: 'L',
        limbs: 5,
        width: 16,
        mask: 65535,
        row: 0,
        startCol: 1,
        direction: 'right'
      },
      0,
      torusGrid,
      span,
      badColDiagnostics
    );
    expect(badColCycles).toHaveLength(0);
    expect(badColDiagnostics.some((d) => d.code === ErrorCodes.Semantic.CoordinateOutOfBounds)).toBe(true);
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

  it('builds stash cycles and validates target bounds', () => {
    const pointDiagnostics: any[] = [];
    const pointCycles = buildStashCycles(
      {
        action: 'save',
        reg: 'R0',
        addr: 'L[0]',
        target: { kind: 'point', row: 3, col: 0 }
      },
      2,
      torusGrid,
      span,
      pointDiagnostics
    );
    expect(pointDiagnostics).toHaveLength(0);
    expect(pointCycles).toHaveLength(1);
    expect(pointCycles[0].index).toBe(2);
    expect(pointCycles[0].statements[0]).toMatchObject({
      row: 3,
      col: 0,
      instruction: { opcode: 'SWI', operands: ['R0', 'L[0]'] }
    });

    const rowDiagnostics: any[] = [];
    const rowCycles = buildStashCycles(
      {
        action: 'restore',
        reg: 'R1',
        addr: 'L[0]',
        target: { kind: 'row', index: 1 }
      },
      0,
      torusGrid,
      span,
      rowDiagnostics
    );
    expect(rowDiagnostics).toHaveLength(0);
    expect(rowCycles).toHaveLength(1);
    expect(rowCycles[0].statements).toHaveLength(torusGrid.cols);

    const colDiagnostics: any[] = [];
    const colCycles = buildStashCycles(
      {
        action: 'save',
        reg: 'R2',
        addr: 'L[1]',
        target: { kind: 'col', index: 2 }
      },
      0,
      torusGrid,
      span,
      colDiagnostics
    );
    expect(colDiagnostics).toHaveLength(0);
    expect(colCycles).toHaveLength(1);
    expect(colCycles[0].statements).toHaveLength(torusGrid.rows);

    const allDiagnostics: any[] = [];
    const allCycles = buildStashCycles(
      {
        action: 'restore',
        reg: 'R3',
        addr: 'L[2]',
        target: { kind: 'all' }
      },
      0,
      torusGrid,
      span,
      allDiagnostics
    );
    expect(allDiagnostics).toHaveLength(0);
    expect(allCycles).toHaveLength(1);
    expect(allCycles[0].statements).toHaveLength(torusGrid.rows * torusGrid.cols);

    const oobDiagnostics: any[] = [];
    const oobCycles = buildStashCycles(
      {
        action: 'save',
        reg: 'R0',
        addr: 'L[0]',
        target: { kind: 'point', row: 9, col: 0 }
      },
      0,
      torusGrid,
      span,
      oobDiagnostics
    );
    expect(oobCycles).toHaveLength(0);
    expect(oobDiagnostics.some((d) => d.code === ErrorCodes.Semantic.CoordinateOutOfBounds)).toBe(true);

    const oobRowDiagnostics: any[] = [];
    const oobRowCycles = buildStashCycles(
      {
        action: 'save',
        reg: 'R0',
        addr: 'L[0]',
        target: { kind: 'row', index: -1 }
      },
      0,
      torusGrid,
      span,
      oobRowDiagnostics
    );
    expect(oobRowCycles).toHaveLength(0);
    expect(oobRowDiagnostics.some((d) => d.code === ErrorCodes.Semantic.CoordinateOutOfBounds)).toBe(true);

    const oobColDiagnostics: any[] = [];
    const oobColCycles = buildStashCycles(
      {
        action: 'restore',
        reg: 'R1',
        addr: 'L[0]',
        target: { kind: 'col', index: 9 }
      },
      0,
      torusGrid,
      span,
      oobColDiagnostics
    );
    expect(oobColCycles).toHaveLength(0);
    expect(oobColDiagnostics.some((d) => d.code === ErrorCodes.Semantic.CoordinateOutOfBounds)).toBe(true);

    const oobPointColDiagnostics: any[] = [];
    const oobPointColCycles = buildStashCycles(
      {
        action: 'save',
        reg: 'R2',
        addr: 'L[3]',
        target: { kind: 'point', row: 0, col: 9 }
      },
      0,
      torusGrid,
      span,
      oobPointColDiagnostics
    );
    expect(oobPointColCycles).toHaveLength(0);
    expect(oobPointColDiagnostics.some((d) => d.code === ErrorCodes.Semantic.CoordinateOutOfBounds)).toBe(true);

    const zeroGridDiagnostics: any[] = [];
    const zeroGridCycles = buildStashCycles(
      {
        action: 'save',
        reg: 'R0',
        addr: 'L[0]',
        target: { kind: 'all' }
      },
      0,
      { rows: 0, cols: 4, topology: 'mesh', wrapPolicy: 'clamp' },
      span,
      zeroGridDiagnostics
    );
    expect(zeroGridDiagnostics).toHaveLength(0);
    expect(zeroGridCycles).toHaveLength(0);
  });

  it('builds mulacc_chain cycles and validates target/direction constraints', () => {
    const okDiagnostics: any[] = [];
    const okCycles = buildMulaccChainCycles(
      {
        srcReg: 'R0',
        coeffReg: 'R1',
        accReg: 'R3',
        outReg: 'R2',
        target: { kind: 'row', index: 0 },
        lanes: 3,
        width: 16,
        mask: 65535,
        direction: 'right'
      },
      7,
      torusGrid,
      span,
      okDiagnostics
    );
    expect(okDiagnostics).toHaveLength(0);
    expect(okCycles).toHaveLength(4);
    expect(okCycles[0].index).toBe(7);
    expect(okCycles[0].statements).toHaveLength(3);
    const firstCycleStmt: any = okCycles[0].statements[0];
    expect(firstCycleStmt.instruction.opcode).toBe('SMUL');
    const secondCycleStmt: any = okCycles[1].statements[0];
    expect(secondCycleStmt.instruction.operands[2]).toBe('ZERO');

    const invalidDirectionDiagnostics: any[] = [];
    const invalidDirectionCycles = buildMulaccChainCycles(
      {
        srcReg: 'R0',
        coeffReg: 'R1',
        accReg: 'R3',
        outReg: 'R2',
        target: { kind: 'row', index: 0 },
        width: 16,
        mask: 65535,
        direction: 'up'
      },
      0,
      torusGrid,
      span,
      invalidDirectionDiagnostics
    );
    expect(invalidDirectionCycles).toHaveLength(0);
    expect(invalidDirectionDiagnostics.some((d) => d.code === ErrorCodes.Semantic.UnsupportedOperation)).toBe(true);

    const invalidLanesDiagnostics: any[] = [];
    const invalidLanesCycles = buildMulaccChainCycles(
      {
        srcReg: 'R0',
        coeffReg: 'R1',
        accReg: 'R3',
        outReg: 'R2',
        target: { kind: 'col', index: 0 },
        lanes: 99,
        width: 16,
        mask: 65535,
        direction: 'down'
      },
      0,
      torusGrid,
      span,
      invalidLanesDiagnostics
    );
    expect(invalidLanesCycles).toHaveLength(0);
    expect(invalidLanesDiagnostics.some((d) => d.code === ErrorCodes.Semantic.UnsupportedOperation)).toBe(true);
  });
});
