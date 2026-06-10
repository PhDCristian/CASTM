import {
  BundleAst,
  Diagnostic,
  ErrorCodes,
  GridSpec,
  SourceSpan,
  makeDiagnostic
} from '@castm/compiler-ir';
import { createInstruction, createMultiAtBundle } from '../ast-utils.js';
import { NormalizeAdvancedStatementArgs } from '../advanced-args.js';

function laneLength(axis: 'row' | 'col', grid: GridSpec): number {
  return axis === 'row' ? grid.cols : grid.rows;
}

function laneLimit(axis: 'row' | 'col', grid: GridSpec): number {
  return axis === 'row' ? grid.rows : grid.cols;
}

function positionFor(axis: 'row' | 'col', lane: number, index: number): { row: number; col: number } {
  if (axis === 'row') {
    return { row: lane, col: index };
  }
  return { row: index, col: lane };
}

function incomingFor(
  axis: 'row' | 'col',
  direction: 'left' | 'right' | 'up' | 'down',
  index: number,
  length: number
): string {
  if (axis === 'row') {
    if (direction === 'right') return index === 0 ? 'ZERO' : 'RCL';
    return index === length - 1 ? 'ZERO' : 'RCR';
  }

  if (direction === 'down') return index === 0 ? 'ZERO' : 'RCT';
  return index === length - 1 ? 'ZERO' : 'RCB';
}

function iterationOrder(length: number, direction: 'left' | 'right' | 'up' | 'down'): number[] {
  if (direction === 'left' || direction === 'up') {
    return Array.from({ length }, (_, index) => length - 1 - index);
  }
  return Array.from({ length }, (_, index) => index);
}

export function buildNormalizeBundles(
  advancedStatement: NormalizeAdvancedStatementArgs,
  startIndex: number,
  grid: GridSpec,
  span: SourceSpan,
  diagnostics: Diagnostic[]
): BundleAst[] {
  if (advancedStatement.width <= 0 || advancedStatement.width >= 31) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Semantic.UnsupportedOperation,
      'error',
      span,
      `Unsupported normalize width '${advancedStatement.width}'.`,
      'Use width in range [1, 30].'
    ));
    return [];
  }

  const laneMax = laneLimit(advancedStatement.axis, grid);
  if (advancedStatement.lane < 0 || advancedStatement.lane >= laneMax) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Semantic.CoordinateOutOfBounds,
      'error',
      span,
      `Normalize lane out of bounds: ${advancedStatement.lane}.`,
      advancedStatement.axis === 'row'
        ? `Lane must be in [0, ${Math.max(0, grid.rows - 1)}] for axis=row.`
        : `Lane must be in [0, ${Math.max(0, grid.cols - 1)}] for axis=col.`
    ));
    return [];
  }

  const length = laneLength(advancedStatement.axis, grid);
  if (length <= 0) {
    return [];
  }

  const reg = advancedStatement.reg.trim().toUpperCase();
  const carryReg = advancedStatement.carryReg.trim().toUpperCase();
  const width = String(advancedStatement.width);
  const mask = String(advancedStatement.mask);

  const order = iterationOrder(length, advancedStatement.direction);

  const shiftPlacements = order.map((index) => {
    const point = positionFor(advancedStatement.axis, advancedStatement.lane, index);
    return {
      row: point.row,
      col: point.col,
      instruction: createInstruction('SRT', [carryReg, reg, width], span)
    };
  });

  const maskPlacements = order.map((index) => {
    const point = positionFor(advancedStatement.axis, advancedStatement.lane, index);
    return {
      row: point.row,
      col: point.col,
      instruction: createInstruction('LAND', [reg, reg, mask], span)
    };
  });

  const relayPlacements = order.map((index) => {
    const point = positionFor(advancedStatement.axis, advancedStatement.lane, index);
    return {
      row: point.row,
      col: point.col,
      instruction: createInstruction('SADD', ['ROUT', carryReg, 'ZERO'], span)
    };
  });

  const addPlacements = order.map((index) => {
    const point = positionFor(advancedStatement.axis, advancedStatement.lane, index);
    const incoming = incomingFor(advancedStatement.axis, advancedStatement.direction, index, length);
    return {
      row: point.row,
      col: point.col,
      instruction: createInstruction('SADD', [reg, reg, incoming], span)
    };
  });

  return [
    createMultiAtBundle(startIndex, shiftPlacements, span),
    createMultiAtBundle(startIndex + 1, maskPlacements, span),
    createMultiAtBundle(startIndex + 2, relayPlacements, span),
    createMultiAtBundle(startIndex + 3, addPlacements, span)
  ];
}
