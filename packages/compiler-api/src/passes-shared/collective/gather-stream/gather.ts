import {
  BundleAst,
  Diagnostic,
  ErrorCodes,
  GridSpec,
  SourceSpan,
  makeDiagnostic
} from '@castm/compiler-ir';
import {
  createAtBundle,
  createInstruction
} from '../../ast-utils.js';
import {
  GatherAdvancedStatementArgs
} from '../../advanced-args.js';
import { isPointInGrid } from '../../grid-utils.js';
import { RoutePoint } from '../../route-args.js';
import { buildRouteTransferBundles } from '../../route-builders.js';
import { pickScratchRegisters } from '../../collective-scan-reduce.js';

function getGatherOpcode(operation: string): string | null {
  switch (operation) {
    case 'sum':
    case 'add':
      return 'SADD';
    case 'and':
      return 'LAND';
    case 'or':
      return 'LOR';
    case 'xor':
      return 'LXOR';
    case 'mul':
      return 'SMUL';
    default:
      return null;
  }
}

export function buildGatherBundles(
  advancedStatement: GatherAdvancedStatementArgs,
  startIndex: number,
  grid: GridSpec,
  span: SourceSpan,
  diagnostics: Diagnostic[]
): BundleAst[] {
  if (!isPointInGrid(advancedStatement.dest, grid)) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Semantic.CoordinateOutOfBounds,
      'error',
      span,
      `Gather destination @${advancedStatement.dest.row},${advancedStatement.dest.col} is outside ${grid.rows}x${grid.cols}.`,
      'Adjust destination coordinates or change CompileOptions.grid.'
    ));
    return [];
  }

  const opcode = getGatherOpcode(advancedStatement.operation);
  if (!opcode) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Semantic.UnsupportedOperation,
      'error',
      span,
      `Unsupported gather operation '${advancedStatement.operation}'.`,
      'Supported operations: add, sum, and, or, xor, mul.'
    ));
    return [];
  }

  const scratch = pickScratchRegisters([advancedStatement.srcReg, advancedStatement.destReg]);
  if (!scratch) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Semantic.UnsupportedOperation,
      'error',
      span,
      `Could not allocate scratch registers for gather destination '${advancedStatement.destReg}'.`,
      'Use a target profile with at least one temporary register besides src/dest registers.'
    ));
    return [];
  }
  const relayReg = scratch[0];

  const bundles: BundleAst[] = [];

  bundles.push(createAtBundle(
    startIndex + bundles.length,
    advancedStatement.dest.row,
    advancedStatement.dest.col,
    createInstruction('SADD', [advancedStatement.destReg, advancedStatement.srcReg, 'ZERO'], span),
    span
  ));

  const sources: RoutePoint[] = [];
  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      if (row === advancedStatement.dest.row && col === advancedStatement.dest.col) continue;
      sources.push({ row, col });
    }
  }
  sources.sort((a, b) => {
    const da = Math.abs(a.row - advancedStatement.dest.row) + Math.abs(a.col - advancedStatement.dest.col);
    const db = Math.abs(b.row - advancedStatement.dest.row) + Math.abs(b.col - advancedStatement.dest.col);
    if (da !== db) return da - db;
    if (a.row !== b.row) return a.row - b.row;
    return a.col - b.col;
  });

  for (const src of sources) {
    const transfer = buildRouteTransferBundles(
      src,
      advancedStatement.dest,
      advancedStatement.srcReg,
      relayReg,
      startIndex + bundles.length,
      grid,
      span,
      diagnostics
    );
    bundles.push(...transfer);

    bundles.push(createAtBundle(
      startIndex + bundles.length,
      advancedStatement.dest.row,
      advancedStatement.dest.col,
      createInstruction(opcode, [advancedStatement.destReg, advancedStatement.destReg, relayReg], span),
      span
    ));
  }

  return bundles;
}
