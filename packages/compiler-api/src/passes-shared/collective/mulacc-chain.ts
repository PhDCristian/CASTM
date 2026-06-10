import {
  BundleAst,
  Diagnostic,
  ErrorCodes,
  GridSpec,
  SourceSpan,
  makeDiagnostic
} from '@castm/compiler-ir';
import { MulaccChainAdvancedStatementArgs } from '../advanced-args.js';
import { createInstruction, createMultiAtBundle } from '../ast-utils.js';

interface LanePlacement {
  row: number;
  col: number;
  boundary: boolean;
}

function incomingForDirection(direction: MulaccChainAdvancedStatementArgs['direction']): 'RCL' | 'RCR' | 'RCT' | 'RCB' {
  if (direction === 'right') return 'RCL';
  if (direction === 'left') return 'RCR';
  if (direction === 'down') return 'RCT';
  return 'RCB';
}

function resolveLaneLimit(
  requested: number | undefined,
  full: number
): number {
  if (requested === undefined) return full;
  return requested;
}

function inBounds(index: number, limit: number): boolean {
  return index >= 0 && index < limit;
}

function horizontalDirection(direction: MulaccChainAdvancedStatementArgs['direction']): boolean {
  return direction === 'left' || direction === 'right';
}

function verticalDirection(direction: MulaccChainAdvancedStatementArgs['direction']): boolean {
  return direction === 'up' || direction === 'down';
}

function buildOrderedIndices(size: number, direction: MulaccChainAdvancedStatementArgs['direction']): number[] {
  const forward = Array.from({ length: size }, (_, i) => i);
  if (direction === 'left' || direction === 'up') {
    return forward.reverse();
  }
  return forward;
}

function buildLanePlacements(
  advancedStatement: MulaccChainAdvancedStatementArgs,
  grid: GridSpec,
  span: SourceSpan,
  diagnostics: Diagnostic[]
): LanePlacement[] | null {
  const placements: LanePlacement[] = [];
  const target = advancedStatement.target;

  if (target.kind === 'row') {
    if (!inBounds(target.index, grid.rows)) {
      diagnostics.push(makeDiagnostic(
        ErrorCodes.Semantic.CoordinateOutOfBounds,
        'error',
        span,
        `mulacc_chain target row(${target.index}) is out of bounds for ${grid.rows}x${grid.cols} grid.`,
        `Use row index in range [0, ${Math.max(0, grid.rows - 1)}].`
      ));
      return null;
    }
    if (!horizontalDirection(advancedStatement.direction)) {
      diagnostics.push(makeDiagnostic(
        ErrorCodes.Semantic.UnsupportedOperation,
        'error',
        span,
        `mulacc_chain target row(...) requires dir=left|right, received '${advancedStatement.direction}'.`,
        'Use dir=left or dir=right for row targets.'
      ));
      return null;
    }

    const laneCount = resolveLaneLimit(advancedStatement.lanes, grid.cols);
    if (!Number.isInteger(laneCount) || laneCount <= 0 || laneCount > grid.cols) {
      diagnostics.push(makeDiagnostic(
        ErrorCodes.Semantic.UnsupportedOperation,
        'error',
        span,
        `mulacc_chain lanes=${String(advancedStatement.lanes)} is invalid for row target on ${grid.cols} columns.`,
        `Use lanes in range [1, ${grid.cols}].`
      ));
      return null;
    }
    const orderedCols = buildOrderedIndices(grid.cols, advancedStatement.direction).slice(0, laneCount);
    orderedCols.forEach((col, lane) => {
      placements.push({
        row: target.index,
        col,
        boundary: lane === 0
      });
    });
    return placements;
  }

  if (target.kind === 'col') {
    if (!inBounds(target.index, grid.cols)) {
      diagnostics.push(makeDiagnostic(
        ErrorCodes.Semantic.CoordinateOutOfBounds,
        'error',
        span,
        `mulacc_chain target col(${target.index}) is out of bounds for ${grid.rows}x${grid.cols} grid.`,
        `Use col index in range [0, ${Math.max(0, grid.cols - 1)}].`
      ));
      return null;
    }
    if (!verticalDirection(advancedStatement.direction)) {
      diagnostics.push(makeDiagnostic(
        ErrorCodes.Semantic.UnsupportedOperation,
        'error',
        span,
        `mulacc_chain target col(...) requires dir=up|down, received '${advancedStatement.direction}'.`,
        'Use dir=up or dir=down for col targets.'
      ));
      return null;
    }

    const laneCount = resolveLaneLimit(advancedStatement.lanes, grid.rows);
    if (!Number.isInteger(laneCount) || laneCount <= 0 || laneCount > grid.rows) {
      diagnostics.push(makeDiagnostic(
        ErrorCodes.Semantic.UnsupportedOperation,
        'error',
        span,
        `mulacc_chain lanes=${String(advancedStatement.lanes)} is invalid for col target on ${grid.rows} rows.`,
        `Use lanes in range [1, ${grid.rows}].`
      ));
      return null;
    }
    const orderedRows = buildOrderedIndices(grid.rows, advancedStatement.direction).slice(0, laneCount);
    orderedRows.forEach((row, lane) => {
      placements.push({
        row,
        col: target.index,
        boundary: lane === 0
      });
    });
    return placements;
  }

  if (horizontalDirection(advancedStatement.direction)) {
    const laneCount = resolveLaneLimit(advancedStatement.lanes, grid.cols);
    if (!Number.isInteger(laneCount) || laneCount <= 0 || laneCount > grid.cols) {
      diagnostics.push(makeDiagnostic(
        ErrorCodes.Semantic.UnsupportedOperation,
        'error',
        span,
        `mulacc_chain lanes=${String(advancedStatement.lanes)} is invalid for target=all with horizontal direction.`,
        `Use lanes in range [1, ${grid.cols}].`
      ));
      return null;
    }
    const orderedCols = buildOrderedIndices(grid.cols, advancedStatement.direction).slice(0, laneCount);
    for (let row = 0; row < grid.rows; row++) {
      orderedCols.forEach((col, lane) => {
        placements.push({
          row,
          col,
          boundary: lane === 0
        });
      });
    }
    return placements;
  }

  const laneCount = resolveLaneLimit(advancedStatement.lanes, grid.rows);
  if (!Number.isInteger(laneCount) || laneCount <= 0 || laneCount > grid.rows) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Semantic.UnsupportedOperation,
      'error',
      span,
      `mulacc_chain lanes=${String(advancedStatement.lanes)} is invalid for target=all with vertical direction.`,
      `Use lanes in range [1, ${grid.rows}].`
    ));
    return null;
  }
  const orderedRows = buildOrderedIndices(grid.rows, advancedStatement.direction).slice(0, laneCount);
  for (let col = 0; col < grid.cols; col++) {
    orderedRows.forEach((row, lane) => {
      placements.push({
        row,
        col,
        boundary: lane === 0
      });
    });
  }
  return placements;
}

function toUpper(value: string): string {
  return value.trim().toUpperCase();
}

export function buildMulaccChainBundles(
  advancedStatement: MulaccChainAdvancedStatementArgs,
  startIndex: number,
  grid: GridSpec,
  span: SourceSpan,
  diagnostics: Diagnostic[]
): BundleAst[] {
  const placements = buildLanePlacements(advancedStatement, grid, span, diagnostics);
  if (!placements || placements.length === 0) return [];

  const srcReg = toUpper(advancedStatement.srcReg);
  const coeffReg = toUpper(advancedStatement.coeffReg);
  const accReg = toUpper(advancedStatement.accReg);
  const outReg = toUpper(advancedStatement.outReg);
  const incoming = incomingForDirection(advancedStatement.direction);
  const width = String(advancedStatement.width);
  const mask = String(advancedStatement.mask);

  const bundles: BundleAst[] = [];

  bundles.push(createMultiAtBundle(
    startIndex + bundles.length,
    placements.map((lane) => ({
      row: lane.row,
      col: lane.col,
      instruction: createInstruction('SMUL', [accReg, srcReg, coeffReg], span)
    })),
    span
  ));

  bundles.push(createMultiAtBundle(
    startIndex + bundles.length,
    placements.map((lane) => ({
      row: lane.row,
      col: lane.col,
      instruction: createInstruction('SADD', [accReg, accReg, lane.boundary ? 'ZERO' : incoming], span)
    })),
    span
  ));

  bundles.push(createMultiAtBundle(
    startIndex + bundles.length,
    placements.map((lane) => ({
      row: lane.row,
      col: lane.col,
      instruction: createInstruction('LAND', [outReg, accReg, mask], span)
    })),
    span
  ));

  bundles.push(createMultiAtBundle(
    startIndex + bundles.length,
    placements.map((lane) => ({
      row: lane.row,
      col: lane.col,
      instruction: createInstruction('SRT', [accReg, accReg, width], span)
    })),
    span
  ));

  return bundles;
}
