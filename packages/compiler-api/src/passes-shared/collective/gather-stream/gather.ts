import {
  CycleAst,
  Diagnostic,
  ErrorCodes,
  GridSpec,
  SourceSpan,
  makeDiagnostic
} from '@castm/compiler-ir';
import {
  createAtCycle,
  createInstruction
} from '../../ast-utils.js';
import {
  GatherPragmaArgs
} from '../../advanced-args.js';
import { isPointInGrid } from '../../grid-utils.js';
import { RoutePoint } from '../../route-args.js';
import { buildRouteTransferCycles } from '../../route-builders.js';
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

export function buildGatherCycles(
  pragma: GatherPragmaArgs,
  startIndex: number,
  grid: GridSpec,
  span: SourceSpan,
  diagnostics: Diagnostic[]
): CycleAst[] {
  if (!isPointInGrid(pragma.dest, grid)) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Semantic.CoordinateOutOfBounds,
      'error',
      span,
      `Gather destination @${pragma.dest.row},${pragma.dest.col} is outside ${grid.rows}x${grid.cols}.`,
      'Adjust destination coordinates or change CompileOptions.grid.'
    ));
    return [];
  }

  const opcode = getGatherOpcode(pragma.operation);
  if (!opcode) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Semantic.UnsupportedOperation,
      'error',
      span,
      `Unsupported gather operation '${pragma.operation}'.`,
      'Supported operations: add, sum, and, or, xor, mul.'
    ));
    return [];
  }

  const scratch = pickScratchRegisters([pragma.srcReg, pragma.destReg]);
  if (!scratch) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Semantic.UnsupportedOperation,
      'error',
      span,
      `Could not allocate scratch registers for gather destination '${pragma.destReg}'.`,
      'Use a target profile with at least one temporary register besides src/dest registers.'
    ));
    return [];
  }
  const relayReg = scratch[0];

  const cycles: CycleAst[] = [];

  cycles.push(createAtCycle(
    startIndex + cycles.length,
    pragma.dest.row,
    pragma.dest.col,
    createInstruction('SADD', [pragma.destReg, pragma.srcReg, 'ZERO'], span),
    span
  ));

  const sources: RoutePoint[] = [];
  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      if (row === pragma.dest.row && col === pragma.dest.col) continue;
      sources.push({ row, col });
    }
  }
  sources.sort((a, b) => {
    const da = Math.abs(a.row - pragma.dest.row) + Math.abs(a.col - pragma.dest.col);
    const db = Math.abs(b.row - pragma.dest.row) + Math.abs(b.col - pragma.dest.col);
    if (da !== db) return da - db;
    if (a.row !== b.row) return a.row - b.row;
    return a.col - b.col;
  });

  for (const src of sources) {
    const transfer = buildRouteTransferCycles(
      src,
      pragma.dest,
      pragma.srcReg,
      relayReg,
      startIndex + cycles.length,
      grid,
      span,
      diagnostics
    );
    cycles.push(...transfer);

    cycles.push(createAtCycle(
      startIndex + cycles.length,
      pragma.dest.row,
      pragma.dest.col,
      createInstruction(opcode, [pragma.destReg, pragma.destReg, relayReg], span),
      span
    ));
  }

  return cycles;
}
