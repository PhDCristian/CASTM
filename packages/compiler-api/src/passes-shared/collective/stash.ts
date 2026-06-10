import {
  BundleAst,
  Diagnostic,
  ErrorCodes,
  GridSpec,
  SourceSpan,
  makeDiagnostic
} from '@castm/compiler-ir';
import { StashAdvancedStatementArgs } from '../advanced-args.js';
import { createInstruction, createMultiAtBundle } from '../ast-utils.js';

interface Point {
  row: number;
  col: number;
}

function targetPoints(target: StashAdvancedStatementArgs['target'], grid: GridSpec): Point[] | null {
  if (target.kind === 'all') {
    const points: Point[] = [];
    for (let row = 0; row < grid.rows; row++) {
      for (let col = 0; col < grid.cols; col++) {
        points.push({ row, col });
      }
    }
    return points;
  }

  if (target.kind === 'row') {
    if (target.index < 0 || target.index >= grid.rows) return null;
    return Array.from({ length: grid.cols }, (_, col) => ({ row: target.index, col }));
  }

  if (target.kind === 'col') {
    if (target.index < 0 || target.index >= grid.cols) return null;
    return Array.from({ length: grid.rows }, (_, row) => ({ row, col: target.index }));
  }

  if (target.row < 0 || target.row >= grid.rows) return null;
  if (target.col < 0 || target.col >= grid.cols) return null;
  return [{ row: target.row, col: target.col }];
}

export function buildStashBundles(
  advancedStatement: StashAdvancedStatementArgs,
  startIndex: number,
  grid: GridSpec,
  span: SourceSpan,
  diagnostics: Diagnostic[]
): BundleAst[] {
  const points = targetPoints(advancedStatement.target, grid);
  if (!points) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Semantic.CoordinateOutOfBounds,
      'error',
      span,
      `stash target is outside grid bounds for ${grid.rows}x${grid.cols}.`,
      'Use target=all|row(N)|col(N)|point(r,c) within configured grid bounds.'
    ));
    return [];
  }

  if (points.length === 0) return [];
  const opcode = advancedStatement.action === 'save' ? 'SWI' : 'LWI';
  return [createMultiAtBundle(
    startIndex,
    points.map((point) => ({
      row: point.row,
      col: point.col,
      instruction: createInstruction(opcode, [advancedStatement.reg, advancedStatement.addr], span)
    })),
    span
  )];
}
