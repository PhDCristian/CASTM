import { describe, expect, it } from 'vitest';
import { ErrorCodes, spanAt } from '@openedge/compiler-ir';
import {
  buildAllreduceCycles,
  buildGatherCycles,
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
});
