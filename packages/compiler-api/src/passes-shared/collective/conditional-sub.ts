import {
  BundleAst,
  Diagnostic,
  ErrorCodes,
  GridSpec,
  SourceSpan,
  makeDiagnostic
} from '@castm/compiler-ir';
import { ConditionalSubAdvancedStatementArgs } from '../advanced-args.js';
import { createInstruction, createMultiAtBundle } from '../ast-utils.js';

function upperToken(value: string): string {
  return value.trim().toUpperCase();
}

function appendOutOfBoundsDiagnostic(
  diagnostics: Diagnostic[],
  span: SourceSpan,
  message: string
): void {
  diagnostics.push(makeDiagnostic(
    ErrorCodes.Semantic.CoordinateOutOfBounds,
    'error',
    span,
    message,
    'Adjust target to a valid row/column/coordinate within the configured grid.'
  ));
}

function resolvePlacements(
  target: ConditionalSubAdvancedStatementArgs['target'],
  grid: GridSpec,
  diagnostics: Diagnostic[],
  span: SourceSpan
): Array<{ row: number; col: number }> {
  if (target.kind === 'all') {
    const points: Array<{ row: number; col: number }> = [];
    for (let row = 0; row < grid.rows; row++) {
      for (let col = 0; col < grid.cols; col++) {
        points.push({ row, col });
      }
    }
    return points;
  }

  if (target.kind === 'row') {
    if (target.index < 0 || target.index >= grid.rows) {
      appendOutOfBoundsDiagnostic(
        diagnostics,
        span,
        `conditional_sub target row(${target.index}) is outside grid rows [0, ${Math.max(0, grid.rows - 1)}].`
      );
      return [];
    }
    return Array.from({ length: grid.cols }, (_, col) => ({ row: target.index, col }));
  }

  if (target.kind === 'col') {
    if (target.index < 0 || target.index >= grid.cols) {
      appendOutOfBoundsDiagnostic(
        diagnostics,
        span,
        `conditional_sub target col(${target.index}) is outside grid cols [0, ${Math.max(0, grid.cols - 1)}].`
      );
      return [];
    }
    return Array.from({ length: grid.rows }, (_, row) => ({ row, col: target.index }));
  }

  if (
    target.row < 0 || target.row >= grid.rows ||
    target.col < 0 || target.col >= grid.cols
  ) {
    appendOutOfBoundsDiagnostic(
      diagnostics,
      span,
      `conditional_sub target @${target.row},${target.col} is outside grid bounds ${grid.rows}x${grid.cols}.`
    );
    return [];
  }
  return [{ row: target.row, col: target.col }];
}

export function buildConditionalSubBundles(
  advancedStatement: ConditionalSubAdvancedStatementArgs,
  startIndex: number,
  grid: GridSpec,
  span: SourceSpan,
  diagnostics: Diagnostic[]
): BundleAst[] {
  const points = resolvePlacements(advancedStatement.target, grid, diagnostics, span);
  if (points.length === 0) return [];

  const valueReg = upperToken(advancedStatement.valueReg);
  const subReg = upperToken(advancedStatement.subReg);
  const destReg = upperToken(advancedStatement.destReg);

  const subtractPlacements = points.map((point) => ({
    row: point.row,
    col: point.col,
    instruction: createInstruction('SSUB', [destReg, valueReg, subReg], span)
  }));
  const selectPlacements = points.map((point) => ({
    row: point.row,
    col: point.col,
    instruction: createInstruction('BSFA', [destReg, valueReg, destReg, 'SELF'], span)
  }));

  return [
    createMultiAtBundle(startIndex, subtractPlacements, span),
    createMultiAtBundle(startIndex + 1, selectPlacements, span)
  ];
}
