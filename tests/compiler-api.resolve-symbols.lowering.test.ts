import { describe, expect, it } from 'vitest';
import { ErrorCodes, spanAt } from '@castm/compiler-ir';
import { addOperation } from '../packages/compiler-api/src/passes-shared/lowering/resolve-symbols/operations.js';
import { lowerCycleStatements } from '../packages/compiler-api/src/passes-shared/lowering/resolve-symbols/cycle-lowering.js';

function inst(opcode: string | null, operands: string[] = [], text?: string) {
  const shown = text ?? (opcode ? `${opcode}${operands.length ? ` ${operands.join(', ')}` : ''}` : 'x = y');
  return {
    text: shown,
    opcode,
    operands,
    span: spanAt(1, 1, 1)
  };
}

const grid: any = {
  rows: 2,
  cols: 3,
  topology: 'torus',
  wrapPolicy: 'wrap'
};

describe('compiler-api resolve-symbols lowering helpers', () => {
  it('covers addOperation guards and label resolution', () => {
    const diagnostics: any[] = [];
    const operations: any[] = [];
    const occupied = new Set<string>();
    const labels = new Map<string, number>([['L1', 7]]);

    addOperation(
      operations,
      occupied,
      0,
      -1,
      0,
      inst('NOP'),
      grid,
      labels,
      diagnostics
    );
    addOperation(
      operations,
      occupied,
      0,
      0,
      0,
      inst(null, [], 'R1 = R2'),
      grid,
      labels,
      diagnostics
    );
    addOperation(
      operations,
      occupied,
      0,
      0,
      0,
      inst('NOT_REAL'),
      grid,
      labels,
      diagnostics
    );
    addOperation(
      operations,
      occupied,
      0,
      0,
      0,
      inst('BEQ', ['R0', 'IMM(0)', 'L1']),
      grid,
      labels,
      diagnostics
    );
    addOperation(
      operations,
      occupied,
      0,
      0,
      0,
      inst('NOP'),
      grid,
      labels,
      diagnostics
    );
    addOperation(
      operations,
      occupied,
      0,
      0,
      1,
      inst('BNE', ['R0', 'R1', 'MISSING_LABEL']),
      grid,
      labels,
      diagnostics
    );
    addOperation(
      operations,
      occupied,
      0,
      0,
      2,
      inst('JUMP', ['MISSING_LABEL']),
      grid,
      labels,
      diagnostics
    );

    const codes = diagnostics.map((d) => d.code);
    expect(codes).toContain(ErrorCodes.Semantic.CoordinateOutOfBounds);
    expect(codes).toContain(ErrorCodes.Semantic.InvalidAssignment);
    expect(codes).toContain(ErrorCodes.Semantic.UnknownOpcode);
    expect(codes).toContain(ErrorCodes.Semantic.Collision);
    expect(codes).toContain(ErrorCodes.Semantic.UnknownLabel);

    expect(operations).toHaveLength(3);
    expect(operations[0]).toMatchObject({
      row: 0,
      col: 0,
      opcode: 'BEQ',
      operands: ['R0', 'IMM(0)', '7']
    });
    // BNE with unknown label triggers E3009 but still emits the operation
    expect(operations[1]).toMatchObject({
      row: 0,
      col: 1,
      opcode: 'BNE',
      operands: ['R0', 'R1', 'MISSING_LABEL']
    });
    // JUMP is a carrier — unknown operands are preserved (could be registers)
    expect(operations[2]).toMatchObject({
      row: 0,
      col: 2,
      opcode: 'JUMP',
      operands: ['MISSING_LABEL']
    });
  });

  it('lowers row statements for single, sparse and overflowing row forms', () => {
    const diagnosticsSingle: any[] = [];
    const single = lowerCycleStatements(
      2,
      [
        {
          kind: 'row',
          row: 1,
          instructions: [inst('NOP')],
          span: spanAt(2, 1, 1)
        }
      ] as any,
      grid,
      new Map(),
      diagnosticsSingle
    );
    expect(diagnosticsSingle).toHaveLength(0);
    expect(single).toHaveLength(3);
    expect(single.every((op) => op.row === 1)).toBe(true);

    const diagnosticsSparse: any[] = [];
    const sparse = lowerCycleStatements(
      2,
      [
        {
          kind: 'row',
          row: 0,
          instructions: [inst('SADD', ['R1', 'R2', 'R3']), inst('NOP')],
          span: spanAt(3, 1, 1)
        }
      ] as any,
      grid,
      new Map(),
      diagnosticsSparse
    );
    expect(diagnosticsSparse).toHaveLength(0);
    expect(sparse).toHaveLength(3);
    expect(sparse.map((op) => op.opcode)).toEqual(['SADD', 'NOP', 'NOP']);

    const diagnosticsOverflow: any[] = [];
    const overflow = lowerCycleStatements(
      2,
      [
        {
          kind: 'row',
          row: 0,
          instructions: [inst('NOP'), inst('NOP'), inst('NOP'), inst('NOP')],
          span: spanAt(4, 1, 1)
        }
      ] as any,
      grid,
      new Map(),
      diagnosticsOverflow
    );
    expect(overflow).toHaveLength(3);
    expect(diagnosticsOverflow.some((d) => d.code === ErrorCodes.Semantic.CoordinateOutOfBounds)).toBe(true);
  });

  it('lowers col/all statements and reports out-of-bounds rows/cols', () => {
    const diagnosticsCol: any[] = [];
    const colOps = lowerCycleStatements(
      3,
      [
        {
          kind: 'col',
          col: 2,
          instruction: inst('NOP'),
          span: spanAt(5, 1, 1)
        }
      ] as any,
      grid,
      new Map(),
      diagnosticsCol
    );
    expect(diagnosticsCol).toHaveLength(0);
    expect(colOps).toHaveLength(2);
    expect(colOps.every((op) => op.col === 2)).toBe(true);

    const diagnosticsAll: any[] = [];
    const allOps = lowerCycleStatements(
      4,
      [
        {
          kind: 'all',
          instruction: inst('NOP'),
          span: spanAt(6, 1, 1)
        }
      ] as any,
      grid,
      new Map(),
      diagnosticsAll
    );
    expect(diagnosticsAll).toHaveLength(0);
    expect(allOps).toHaveLength(grid.rows * grid.cols);

    const diagnosticsBounds: any[] = [];
    const boundsOps = lowerCycleStatements(
      5,
      [
        {
          kind: 'row',
          row: 9,
          instructions: [inst('NOP')],
          span: spanAt(7, 1, 1)
        },
        {
          kind: 'col',
          col: 9,
          instruction: inst('NOP'),
          span: spanAt(8, 1, 1)
        }
      ] as any,
      grid,
      new Map(),
      diagnosticsBounds
    );
    expect(boundsOps).toHaveLength(0);
    expect(diagnosticsBounds.filter((d) => d.code === ErrorCodes.Semantic.CoordinateOutOfBounds)).toHaveLength(2);
  });
});
