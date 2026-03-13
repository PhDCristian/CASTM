import {
  CycleAst,
  Diagnostic,
  ErrorCodes,
  GridSpec,
  SourceSpan,
  makeDiagnostic
} from '@castm/compiler-ir';
import { MulaccChainPragmaArgs } from '../advanced-args.js';
import { createInstruction, createMultiAtCycle } from '../ast-utils.js';

interface LanePlacement {
  row: number;
  col: number;
  boundary: boolean;
}

function incomingForDirection(direction: MulaccChainPragmaArgs['direction']): 'RCL' | 'RCR' | 'RCT' | 'RCB' {
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

function horizontalDirection(direction: MulaccChainPragmaArgs['direction']): boolean {
  return direction === 'left' || direction === 'right';
}

function verticalDirection(direction: MulaccChainPragmaArgs['direction']): boolean {
  return direction === 'up' || direction === 'down';
}

function buildOrderedIndices(size: number, direction: MulaccChainPragmaArgs['direction']): number[] {
  const forward = Array.from({ length: size }, (_, i) => i);
  if (direction === 'left' || direction === 'up') {
    return forward.reverse();
  }
  return forward;
}

function buildLanePlacements(
  pragma: MulaccChainPragmaArgs,
  grid: GridSpec,
  span: SourceSpan,
  diagnostics: Diagnostic[]
): LanePlacement[] | null {
  const placements: LanePlacement[] = [];
  const target = pragma.target;

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
    if (!horizontalDirection(pragma.direction)) {
      diagnostics.push(makeDiagnostic(
        ErrorCodes.Semantic.UnsupportedOperation,
        'error',
        span,
        `mulacc_chain target row(...) requires dir=left|right, received '${pragma.direction}'.`,
        'Use dir=left or dir=right for row targets.'
      ));
      return null;
    }

    const laneCount = resolveLaneLimit(pragma.lanes, grid.cols);
    if (!Number.isInteger(laneCount) || laneCount <= 0 || laneCount > grid.cols) {
      diagnostics.push(makeDiagnostic(
        ErrorCodes.Semantic.UnsupportedOperation,
        'error',
        span,
        `mulacc_chain lanes=${String(pragma.lanes)} is invalid for row target on ${grid.cols} columns.`,
        `Use lanes in range [1, ${grid.cols}].`
      ));
      return null;
    }
    const orderedCols = buildOrderedIndices(grid.cols, pragma.direction).slice(0, laneCount);
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
    if (!verticalDirection(pragma.direction)) {
      diagnostics.push(makeDiagnostic(
        ErrorCodes.Semantic.UnsupportedOperation,
        'error',
        span,
        `mulacc_chain target col(...) requires dir=up|down, received '${pragma.direction}'.`,
        'Use dir=up or dir=down for col targets.'
      ));
      return null;
    }

    const laneCount = resolveLaneLimit(pragma.lanes, grid.rows);
    if (!Number.isInteger(laneCount) || laneCount <= 0 || laneCount > grid.rows) {
      diagnostics.push(makeDiagnostic(
        ErrorCodes.Semantic.UnsupportedOperation,
        'error',
        span,
        `mulacc_chain lanes=${String(pragma.lanes)} is invalid for col target on ${grid.rows} rows.`,
        `Use lanes in range [1, ${grid.rows}].`
      ));
      return null;
    }
    const orderedRows = buildOrderedIndices(grid.rows, pragma.direction).slice(0, laneCount);
    orderedRows.forEach((row, lane) => {
      placements.push({
        row,
        col: target.index,
        boundary: lane === 0
      });
    });
    return placements;
  }

  if (horizontalDirection(pragma.direction)) {
    const laneCount = resolveLaneLimit(pragma.lanes, grid.cols);
    if (!Number.isInteger(laneCount) || laneCount <= 0 || laneCount > grid.cols) {
      diagnostics.push(makeDiagnostic(
        ErrorCodes.Semantic.UnsupportedOperation,
        'error',
        span,
        `mulacc_chain lanes=${String(pragma.lanes)} is invalid for target=all with horizontal direction.`,
        `Use lanes in range [1, ${grid.cols}].`
      ));
      return null;
    }
    const orderedCols = buildOrderedIndices(grid.cols, pragma.direction).slice(0, laneCount);
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

  const laneCount = resolveLaneLimit(pragma.lanes, grid.rows);
  if (!Number.isInteger(laneCount) || laneCount <= 0 || laneCount > grid.rows) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Semantic.UnsupportedOperation,
      'error',
      span,
      `mulacc_chain lanes=${String(pragma.lanes)} is invalid for target=all with vertical direction.`,
      `Use lanes in range [1, ${grid.rows}].`
    ));
    return null;
  }
  const orderedRows = buildOrderedIndices(grid.rows, pragma.direction).slice(0, laneCount);
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

export function buildMulaccChainCycles(
  pragma: MulaccChainPragmaArgs,
  startIndex: number,
  grid: GridSpec,
  span: SourceSpan,
  diagnostics: Diagnostic[]
): CycleAst[] {
  const placements = buildLanePlacements(pragma, grid, span, diagnostics);
  if (!placements || placements.length === 0) return [];

  const srcReg = toUpper(pragma.srcReg);
  const coeffReg = toUpper(pragma.coeffReg);
  const accReg = toUpper(pragma.accReg);
  const outReg = toUpper(pragma.outReg);
  const incoming = incomingForDirection(pragma.direction);
  const width = String(pragma.width);
  const mask = String(pragma.mask);

  const cycles: CycleAst[] = [];

  cycles.push(createMultiAtCycle(
    startIndex + cycles.length,
    placements.map((lane) => ({
      row: lane.row,
      col: lane.col,
      instruction: createInstruction('SMUL', [accReg, srcReg, coeffReg], span)
    })),
    span
  ));

  cycles.push(createMultiAtCycle(
    startIndex + cycles.length,
    placements.map((lane) => ({
      row: lane.row,
      col: lane.col,
      instruction: createInstruction('SADD', [accReg, accReg, lane.boundary ? 'ZERO' : incoming], span)
    })),
    span
  ));

  cycles.push(createMultiAtCycle(
    startIndex + cycles.length,
    placements.map((lane) => ({
      row: lane.row,
      col: lane.col,
      instruction: createInstruction('LAND', [outReg, accReg, mask], span)
    })),
    span
  ));

  cycles.push(createMultiAtCycle(
    startIndex + cycles.length,
    placements.map((lane) => ({
      row: lane.row,
      col: lane.col,
      instruction: createInstruction('SRT', [accReg, accReg, width], span)
    })),
    span
  ));

  return cycles;
}
