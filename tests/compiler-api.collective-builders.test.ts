import { describe, expect, it } from 'vitest';
import { ErrorCodes, spanAt } from '@castm/compiler-ir';
import {
  buildAccumulateBundles,
  buildAllreduceBundles,
  buildCarryChainBundles,
  buildCollectBundles,
  buildConditionalSubBundles,
  buildExtractBytesBundles,
  buildGatherBundles,
  buildMulaccChainBundles,
  buildNormalizeBundles,
  buildStashBundles,
  buildStencilBundles,
  buildStreamBundles,
  buildTransposeBundles
} from '../packages/compiler-api/src/passes-shared/collective-builders.js';
import {
  buildBroadcastBundles,
  buildRotateShiftBundles
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
  it('builds allreduce bundles and composes reduce + broadcast', () => {
    const diagnostics: any[] = [];
    const bundles = buildAllreduceBundles(
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
    expect(bundles.length).toBeGreaterThan(0);
    expect(bundles[0].index).toBe(3);
    const opcodes = bundles.flatMap((bundle) =>
      bundle.statements.flatMap((stmt) => stmt.kind === 'row' ? stmt.instructions.map((inst) => inst.opcode) : [stmt.instruction.opcode])
    );
    expect(opcodes).toContain('SADD');
  });

  it('builds stencil bundles for cross pattern and rejects unsupported operation', () => {
    const okDiagnostics: any[] = [];
    const okBundles = buildStencilBundles(
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
    expect(okBundles).toHaveLength(4);
    expect(okBundles[0].statements).toHaveLength(torusGrid.rows * torusGrid.cols);

    const badDiagnostics: any[] = [];
    const badBundles = buildStencilBundles(
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
    expect(badBundles).toHaveLength(0);
    expect(badDiagnostics.some((d) => d.code === ErrorCodes.Semantic.UnsupportedOperation)).toBe(true);
  });

  it('validates transpose constraints and emits bundles on square grid', () => {
    const nonSquareDiagnostics: any[] = [];
    const nonSquareBundles = buildTransposeBundles(
      { reg: 'R0' },
      0,
      { ...torusGrid, rows: 2, cols: 3 },
      span,
      nonSquareDiagnostics
    );
    expect(nonSquareBundles).toHaveLength(0);
    expect(nonSquareDiagnostics.some((d) => d.code === ErrorCodes.Semantic.UnsupportedOperation)).toBe(true);

    const squareDiagnostics: any[] = [];
    const squareBundles = buildTransposeBundles(
      { reg: 'R0' },
      4,
      torusGrid,
      span,
      squareDiagnostics
    );
    expect(squareDiagnostics).toHaveLength(0);
    expect(squareBundles.length).toBeGreaterThan(0);
    expect(squareBundles[0].index).toBe(4);
  });

  it('validates gather destination/op and builds gather sequence', () => {
    const badDstDiagnostics: any[] = [];
    const badDstBundles = buildGatherBundles(
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
    expect(badDstBundles).toHaveLength(0);
    expect(badDstDiagnostics.some((d) => d.code === ErrorCodes.Semantic.CoordinateOutOfBounds)).toBe(true);

    const badOpDiagnostics: any[] = [];
    const badOpBundles = buildGatherBundles(
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
    expect(badOpBundles).toHaveLength(0);
    expect(badOpDiagnostics.some((d) => d.code === ErrorCodes.Semantic.UnsupportedOperation)).toBe(true);

    const okDiagnostics: any[] = [];
    const okBundles = buildGatherBundles(
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
    expect(okBundles.length).toBeGreaterThan(1);
    expect(okBundles[0].index).toBe(2);
    const firstStmt: any = okBundles[0].statements[0];
    expect(firstStmt.instruction.text).toContain('SADD R1, R0, ZERO');
  });

  it('validates stream row/count and builds row bundles', () => {
    const badRowDiagnostics: any[] = [];
    const badRowBundles = buildStreamBundles('LWD', 'R1', 9, 2, 0, torusGrid, span, badRowDiagnostics);
    expect(badRowBundles).toHaveLength(0);
    expect(badRowDiagnostics.some((d) => d.code === ErrorCodes.Semantic.CoordinateOutOfBounds)).toBe(true);

    const badCountDiagnostics: any[] = [];
    const badCountBundles = buildStreamBundles('SWD', 'R2', 0, 0, 0, torusGrid, span, badCountDiagnostics);
    expect(badCountBundles).toHaveLength(0);
    expect(badCountDiagnostics.some((d) => d.code === ErrorCodes.Semantic.UnsupportedOperation)).toBe(true);

    const okDiagnostics: any[] = [];
    const okBundles = buildStreamBundles('LWD', 'R1', 1, 3, 5, torusGrid, span, okDiagnostics);
    expect(okDiagnostics).toHaveLength(0);
    expect(okBundles).toHaveLength(3);
    expect(okBundles[0].index).toBe(5);
    expect(okBundles[0].statements[0].kind).toBe('row');
  });

  it('builds broadcast and rotate/shift route bundles', () => {
    const broadcastDiagnostics: any[] = [];
    const broadcastBundles = buildBroadcastBundles(
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
    expect(broadcastBundles.length).toBeGreaterThan(0);

    const rotateMeshDiagnostics: any[] = [];
    const rotateMeshBundles = buildRotateShiftBundles(
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
    expect(rotateMeshBundles).toHaveLength(0);
    expect(rotateMeshDiagnostics.some((d) => d.code === ErrorCodes.Semantic.UnsupportedOperation)).toBe(true);

    const shiftDiagnostics: any[] = [];
    const shiftBundles = buildRotateShiftBundles(
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
    expect(shiftBundles).toHaveLength(4);
    expect(shiftBundles[0].index).toBe(10);
    const hasFill = shiftBundles.some((bundle) =>
      bundle.statements.some((stmt) => stmt.kind === 'at' && stmt.instruction.text.includes('ZERO, 7'))
    );
    expect(hasFill).toBe(true);
  });

  it('builds collect bundles and validates collect constraints', () => {
    const okDiagnostics: any[] = [];
    const okBundles = buildCollectBundles(
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
    expect(okBundles).toHaveLength(2);
    expect(okBundles[0].index).toBe(6);
    const secondBundleStatements: any[] = okBundles[1].statements as any[];
    expect(secondBundleStatements[0].instruction.operands).toEqual(['R3', 'R2', 'ZERO']);
    expect(secondBundleStatements[1].instruction.operands).toEqual(['R3', 'R2', 'RCL']);

    const badViaDiagnostics: any[] = [];
    const badViaBundles = buildCollectBundles(
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
    expect(badViaBundles).toHaveLength(0);
    expect(badViaDiagnostics.some((d) => d.code === ErrorCodes.Semantic.UnsupportedOperation)).toBe(true);

    const copyDiagnostics: any[] = [];
    const copyBundles = buildCollectBundles(
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
    expect(copyBundles).toHaveLength(1);

    const colShiftDiagnostics: any[] = [];
    const colShiftBundles = buildCollectBundles(
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
    expect(colShiftBundles).toHaveLength(2);
    const colShiftSecond: any[] = colShiftBundles[1].statements as any[];
    expect(colShiftSecond[0].instruction.operands).toEqual(['R3', 'R2', 'ZERO']);
    expect(colShiftSecond[1].instruction.operands).toEqual(['R3', 'R2', 'RCT']);

    const rowReverseDiagnostics: any[] = [];
    const rowReverseBundles = buildCollectBundles(
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
    expect(rowReverseBundles).toHaveLength(2);

    const colForwardDiagnostics: any[] = [];
    const colForwardBundles = buildCollectBundles(
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
    expect(colForwardBundles).toHaveLength(2);

    const zeroLaneDiagnostics: any[] = [];
    const zeroLaneBundles = buildCollectBundles(
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
    expect(zeroLaneBundles).toHaveLength(0);

    const badCombineDiagnostics: any[] = [];
    const badCombineBundles = buildCollectBundles(
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
    expect(badCombineBundles).toHaveLength(0);
    expect(badCombineDiagnostics.some((d) => d.code === ErrorCodes.Semantic.UnsupportedOperation)).toBe(true);

    const invalidViaDiagnostics: any[] = [];
    const invalidViaBundles = buildCollectBundles(
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
    expect(invalidViaBundles).toHaveLength(0);
    expect(invalidViaDiagnostics.some((d) => d.code === ErrorCodes.Semantic.UnsupportedOperation)).toBe(true);

    const rowBoundsDiagnostics: any[] = [];
    const rowBoundsBundles = buildCollectBundles(
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
    expect(rowBoundsBundles).toHaveLength(0);
    expect(rowBoundsDiagnostics.some((d) => d.code === ErrorCodes.Semantic.CoordinateOutOfBounds)).toBe(true);

    const colNonAdjacentDiagnostics: any[] = [];
    const colNonAdjacentBundles = buildCollectBundles(
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
    expect(colNonAdjacentBundles).toHaveLength(0);
    expect(colNonAdjacentDiagnostics.some((d) => d.code === ErrorCodes.Semantic.InvalidCollectPath)).toBe(true);

    const badBoundsDiagnostics: any[] = [];
    const badBoundsBundles = buildCollectBundles(
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
    expect(badBoundsBundles).toHaveLength(0);
    expect(badBoundsDiagnostics.some((d) => d.code === ErrorCodes.Semantic.CoordinateOutOfBounds)).toBe(true);
  });

  it('builds accumulate bundles for row/col/anti_diagonal patterns', () => {
    const antiDiagDiagnostics: any[] = [];
    const antiDiagBundles = buildAccumulateBundles(
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
    expect(antiDiagBundles).toHaveLength(4);
    expect(antiDiagBundles[0].index).toBe(4);
    expect(antiDiagBundles[1].statements[0]).toMatchObject({
      row: 0,
      col: 0,
      instruction: { operands: ['R3', 'R3', 'ZERO'] }
    });
    expect(antiDiagBundles[1].statements[5]).toMatchObject({
      row: 1,
      col: 1,
      instruction: { operands: ['R3', 'R3', 'RCT'] }
    });
    expect(antiDiagBundles[2].statements[0]).toMatchObject({
      row: 0,
      col: 0,
      instruction: { operands: ['R3', 'R3', 'RCR'] }
    });
    expect(antiDiagBundles[3].statements[0]).toMatchObject({
      instruction: { operands: ['ROUT', 'R3', 'ZERO'] }
    });

    const rowDiagnostics: any[] = [];
    const rowBundles = buildAccumulateBundles(
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
    expect(rowBundles).toHaveLength(3);
    expect(rowBundles[1].statements[0]).toMatchObject({
      instruction: { opcode: 'LXOR', operands: ['R1', 'R1', 'ZERO'] }
    });
    expect(rowBundles[1].statements[1]).toMatchObject({
      instruction: { opcode: 'LXOR', operands: ['R1', 'R1', 'RCL'] }
    });

    const colDiagnostics: any[] = [];
    const colBundles = buildAccumulateBundles(
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
    expect(colBundles).toHaveLength(3);
    expect(colBundles[1].statements[0]).toMatchObject({
      instruction: { opcode: 'SSUB', operands: ['R1', 'R1', 'ZERO'] }
    });
    expect(colBundles[1].statements[4]).toMatchObject({
      instruction: { opcode: 'SSUB', operands: ['R1', 'R1', 'RCT'] }
    });

    const badCombineDiagnostics: any[] = [];
    const badCombineBundles = buildAccumulateBundles(
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
    expect(badCombineBundles).toHaveLength(0);
    expect(badCombineDiagnostics.some((d) => d.code === ErrorCodes.Semantic.UnsupportedOperation)).toBe(true);

    const badPatternDiagnostics: any[] = [];
    const badPatternBundles = buildAccumulateBundles(
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
    expect(badPatternBundles).toHaveLength(0);
    expect(badPatternDiagnostics.some((d) => d.code === ErrorCodes.Semantic.UnsupportedOperation)).toBe(true);

    const steppedDiagnostics: any[] = [];
    const steppedBundles = buildAccumulateBundles(
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
    expect(steppedBundles).toHaveLength(4); // seed + 2 row passes + final
    expect(steppedBundles[1].statements[1]).toMatchObject({
      instruction: { opcode: 'SADD', operands: ['R1', 'R1', 'RCL'] }
    });
    expect(steppedBundles[2].statements[1]).toMatchObject({
      instruction: { opcode: 'SADD', operands: ['R1', 'R1', 'RCL'] }
    });

    const optimizedDiagnostics: any[] = [];
    const optimizedBundles = buildAccumulateBundles(
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
    expect(optimizedBundles).toHaveLength(1); // only combine stage remains

    const tooDeepDiagnostics: any[] = [];
    const tooDeepBundles = buildAccumulateBundles(
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
    expect(tooDeepBundles).toHaveLength(0);
    expect(tooDeepDiagnostics.some((d) => d.code === ErrorCodes.Semantic.UnsupportedOperation)).toBe(true);

    const scopedRowDiagnostics: any[] = [];
    const scopedRowBundles = buildAccumulateBundles(
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
    expect(scopedRowBundles).toHaveLength(3);
    expect(scopedRowBundles[0].statements).toHaveLength(4);
    expect(scopedRowBundles[1].statements.every((s: any) => s.row === 2)).toBe(true);

    const scopedColDiagnostics: any[] = [];
    const scopedColBundles = buildAccumulateBundles(
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
    expect(scopedColBundles).toHaveLength(3);
    expect(scopedColBundles[0].statements).toHaveLength(4);
    expect(scopedColBundles[1].statements.every((s: any) => s.col === 1)).toBe(true);

    const scopedMismatchDiagnostics: any[] = [];
    const scopedMismatchBundles = buildAccumulateBundles(
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
    expect(scopedMismatchBundles).toHaveLength(0);
    expect(scopedMismatchDiagnostics.some((d) => d.code === ErrorCodes.Semantic.UnsupportedOperation)).toBe(true);

    const outOfBoundsScopeDiagnostics: any[] = [];
    const outOfBoundsScopeBundles = buildAccumulateBundles(
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
    expect(outOfBoundsScopeBundles).toHaveLength(0);
    expect(outOfBoundsScopeDiagnostics.some((d) => d.code === ErrorCodes.Semantic.CoordinateOutOfBounds)).toBe(true);
  });

  it('builds conditional_sub bundles and validates spatial targets', () => {
    const allDiagnostics: any[] = [];
    const allBundles = buildConditionalSubBundles(
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
    expect(allBundles).toHaveLength(2);
    expect(allBundles[0].index).toBe(9);
    expect(allBundles[0].statements).toHaveLength(16);
    expect(allBundles[1].statements[0]).toMatchObject({
      instruction: { opcode: 'BSFA', operands: ['R2', 'R0', 'R2', 'SELF'] }
    });

    const rowDiagnostics: any[] = [];
    const rowBundles = buildConditionalSubBundles(
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
    expect(rowBundles[0].statements).toHaveLength(4);
    expect(rowBundles[0].statements[0]).toMatchObject({ row: 2, col: 0 });

    const colDiagnostics: any[] = [];
    const colBundles = buildConditionalSubBundles(
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
    expect(colBundles[0].statements).toHaveLength(4);
    expect(colBundles[0].statements[0]).toMatchObject({ row: 0, col: 1 });

    const pointDiagnostics: any[] = [];
    const pointBundles = buildConditionalSubBundles(
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
    expect(pointBundles[0].statements).toHaveLength(1);
    expect(pointBundles[0].statements[0]).toMatchObject({ row: 1, col: 3 });

    const badRowDiagnostics: any[] = [];
    const badRowBundles = buildConditionalSubBundles(
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
    expect(badRowBundles).toHaveLength(0);
    expect(badRowDiagnostics.some((d) => d.code === ErrorCodes.Semantic.CoordinateOutOfBounds)).toBe(true);

    const badPointDiagnostics: any[] = [];
    const badPointBundles = buildConditionalSubBundles(
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
    expect(badPointBundles).toHaveLength(0);
    expect(badPointDiagnostics.some((d) => d.code === ErrorCodes.Semantic.CoordinateOutOfBounds)).toBe(true);
  });

  it('builds carry_chain bundles and validates geometry bounds', () => {
    const okDiagnostics: any[] = [];
    const okBundles = buildCarryChainBundles(
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
    expect(okBundles).toHaveLength(12);
    expect(okBundles[0].statements[0]).toMatchObject({
      instruction: { opcode: 'SADD', operands: ['R0', 'R0', 'R3'] }
    });
    expect(okBundles[2].statements[0]).toMatchObject({
      instruction: { opcode: 'SWI', operands: ['R0', 'L[0]'] }
    });
    expect(okBundles[11].statements[0]).toMatchObject({
      instruction: { opcode: 'SRT', operands: ['R3', 'R0', '16'] }
    });

    const leftDiagnostics: any[] = [];
    const leftBundles = buildCarryChainBundles(
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
    expect(leftBundles).toHaveLength(8);
    expect(leftBundles[4].statements[0]).toMatchObject({ row: 1, col: 2 });

    const badRowDiagnostics: any[] = [];
    const badRowBundles = buildCarryChainBundles(
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
    expect(badRowBundles).toHaveLength(0);
    expect(badRowDiagnostics.some((d) => d.code === ErrorCodes.Semantic.CoordinateOutOfBounds)).toBe(true);

    const badColDiagnostics: any[] = [];
    const badColBundles = buildCarryChainBundles(
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
    expect(badColBundles).toHaveLength(0);
    expect(badColDiagnostics.some((d) => d.code === ErrorCodes.Semantic.CoordinateOutOfBounds)).toBe(true);
  });

  it('builds normalize bundles and validates lane/width constraints', () => {
    const rowDiagnostics: any[] = [];
    const rowBundles = buildNormalizeBundles(
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
    expect(rowBundles).toHaveLength(4);
    expect(rowBundles[0].index).toBe(2);
    const rowAddOperands: any[] = (rowBundles[3].statements as any[]).map((stmt) => stmt.instruction.operands);
    expect(rowAddOperands[0]).toEqual(['R3', 'R3', 'ZERO']);
    expect(rowAddOperands[1]).toEqual(['R3', 'R3', 'RCL']);

    const colDiagnostics: any[] = [];
    const colBundles = buildNormalizeBundles(
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
    expect(colBundles).toHaveLength(4);
    const colAddOperands: any[] = (colBundles[3].statements as any[]).map((stmt) => stmt.instruction.operands);
    expect(colAddOperands[0]).toEqual(['R2', 'R2', 'ZERO']);
    expect(colAddOperands[1]).toEqual(['R2', 'R2', 'RCB']);

    const rowLeftDiagnostics: any[] = [];
    const rowLeftBundles = buildNormalizeBundles(
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
    const rowLeftAddOperands: any[] = (rowLeftBundles[3].statements as any[]).map((stmt) => stmt.instruction.operands);
    expect(rowLeftAddOperands[0]).toEqual(['R3', 'R3', 'ZERO']);
    expect(rowLeftAddOperands[1]).toEqual(['R3', 'R3', 'RCR']);

    const colDownDiagnostics: any[] = [];
    const colDownBundles = buildNormalizeBundles(
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
    const colDownAddOperands: any[] = (colDownBundles[3].statements as any[]).map((stmt) => stmt.instruction.operands);
    expect(colDownAddOperands[0]).toEqual(['R2', 'R2', 'ZERO']);
    expect(colDownAddOperands[1]).toEqual(['R2', 'R2', 'RCT']);

    const badWidthDiagnostics: any[] = [];
    const badWidthBundles = buildNormalizeBundles(
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
    expect(badWidthBundles).toHaveLength(0);
    expect(badWidthDiagnostics.some((d) => d.code === ErrorCodes.Semantic.UnsupportedOperation)).toBe(true);

    const badLaneDiagnostics: any[] = [];
    const badLaneBundles = buildNormalizeBundles(
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
    expect(badLaneBundles).toHaveLength(0);
    expect(badLaneDiagnostics.some((d) => d.code === ErrorCodes.Semantic.CoordinateOutOfBounds)).toBe(true);

    const zeroLengthDiagnostics: any[] = [];
    const zeroLengthBundles = buildNormalizeBundles(
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
    expect(zeroLengthBundles).toHaveLength(0);
  });

  it('builds extract_bytes bundles and validates byte width constraints', () => {
    const okDiagnostics: any[] = [];
    const okBundles = buildExtractBytesBundles(
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
    expect(okBundles).toHaveLength(2);
    expect(okBundles[0].index).toBe(4);
    expect(okBundles[0].statements[0]).toMatchObject({
      row: 0,
      col: 0,
      instruction: { operands: ['R1', 'R0', '0'] }
    });
    expect(okBundles[0].statements[4]).toMatchObject({
      row: 1,
      col: 0,
      instruction: { operands: ['R1', 'R0', '8'] }
    });
    expect(okBundles[1].statements[0]).toMatchObject({
      instruction: { opcode: 'LAND', operands: ['R1', 'R1', '255'] }
    });

    const badWidthDiagnostics: any[] = [];
    const badWidthBundles = buildExtractBytesBundles(
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
    expect(badWidthBundles).toHaveLength(0);
    expect(badWidthDiagnostics.some((d) => d.code === ErrorCodes.Semantic.UnsupportedOperation)).toBe(true);

    const zeroGridDiagnostics: any[] = [];
    const zeroGridBundles = buildExtractBytesBundles(
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
    expect(zeroGridBundles).toHaveLength(0);
  });

  it('builds stash bundles and validates target bounds', () => {
    const pointDiagnostics: any[] = [];
    const pointBundles = buildStashBundles(
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
    expect(pointBundles).toHaveLength(1);
    expect(pointBundles[0].index).toBe(2);
    expect(pointBundles[0].statements[0]).toMatchObject({
      row: 3,
      col: 0,
      instruction: { opcode: 'SWI', operands: ['R0', 'L[0]'] }
    });

    const rowDiagnostics: any[] = [];
    const rowBundles = buildStashBundles(
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
    expect(rowBundles).toHaveLength(1);
    expect(rowBundles[0].statements).toHaveLength(torusGrid.cols);

    const colDiagnostics: any[] = [];
    const colBundles = buildStashBundles(
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
    expect(colBundles).toHaveLength(1);
    expect(colBundles[0].statements).toHaveLength(torusGrid.rows);

    const allDiagnostics: any[] = [];
    const allBundles = buildStashBundles(
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
    expect(allBundles).toHaveLength(1);
    expect(allBundles[0].statements).toHaveLength(torusGrid.rows * torusGrid.cols);

    const oobDiagnostics: any[] = [];
    const oobBundles = buildStashBundles(
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
    expect(oobBundles).toHaveLength(0);
    expect(oobDiagnostics.some((d) => d.code === ErrorCodes.Semantic.CoordinateOutOfBounds)).toBe(true);

    const oobRowDiagnostics: any[] = [];
    const oobRowBundles = buildStashBundles(
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
    expect(oobRowBundles).toHaveLength(0);
    expect(oobRowDiagnostics.some((d) => d.code === ErrorCodes.Semantic.CoordinateOutOfBounds)).toBe(true);

    const oobColDiagnostics: any[] = [];
    const oobColBundles = buildStashBundles(
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
    expect(oobColBundles).toHaveLength(0);
    expect(oobColDiagnostics.some((d) => d.code === ErrorCodes.Semantic.CoordinateOutOfBounds)).toBe(true);

    const oobPointColDiagnostics: any[] = [];
    const oobPointColBundles = buildStashBundles(
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
    expect(oobPointColBundles).toHaveLength(0);
    expect(oobPointColDiagnostics.some((d) => d.code === ErrorCodes.Semantic.CoordinateOutOfBounds)).toBe(true);

    const zeroGridDiagnostics: any[] = [];
    const zeroGridBundles = buildStashBundles(
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
    expect(zeroGridBundles).toHaveLength(0);
  });

  it('builds mulacc_chain bundles and validates target/direction constraints', () => {
    const okDiagnostics: any[] = [];
    const okBundles = buildMulaccChainBundles(
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
    expect(okBundles).toHaveLength(4);
    expect(okBundles[0].index).toBe(7);
    expect(okBundles[0].statements).toHaveLength(3);
    const firstBundleStmt: any = okBundles[0].statements[0];
    expect(firstBundleStmt.instruction.opcode).toBe('SMUL');
    const secondBundleStmt: any = okBundles[1].statements[0];
    expect(secondBundleStmt.instruction.operands[2]).toBe('ZERO');

    const invalidDirectionDiagnostics: any[] = [];
    const invalidDirectionBundles = buildMulaccChainBundles(
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
    expect(invalidDirectionBundles).toHaveLength(0);
    expect(invalidDirectionDiagnostics.some((d) => d.code === ErrorCodes.Semantic.UnsupportedOperation)).toBe(true);

    const invalidLanesDiagnostics: any[] = [];
    const invalidLanesBundles = buildMulaccChainBundles(
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
    expect(invalidLanesBundles).toHaveLength(0);
    expect(invalidLanesDiagnostics.some((d) => d.code === ErrorCodes.Semantic.UnsupportedOperation)).toBe(true);
  });
});
