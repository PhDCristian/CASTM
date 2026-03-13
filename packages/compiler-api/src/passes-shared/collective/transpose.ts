import {
  CycleAst,
  Diagnostic,
  ErrorCodes,
  GridSpec,
  SourceSpan,
  makeDiagnostic
} from '@castm/compiler-ir';
import {
  createInstruction,
  createMultiAtCycle
} from '../ast-utils.js';
import { TransposePragmaArgs } from '../advanced-args.js';
import { RoutePoint } from '../route-args.js';
import { buildRouteTransferCycles } from '../route-builders.js';
import { pickScratchRegisters } from '../collective-scan-reduce.js';

export function buildTransposeCycles(
  pragma: TransposePragmaArgs,
  startIndex: number,
  grid: GridSpec,
  span: SourceSpan,
  diagnostics: Diagnostic[]
): CycleAst[] {
  if (grid.rows !== grid.cols) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Semantic.UnsupportedOperation,
      'error',
      span,
      `transpose(...) requires a square grid, got ${grid.rows}x${grid.cols}.`,
      'Use a square grid (e.g. 4x4) for transpose lowering.'
    ));
    return [];
  }

  const scratch = pickScratchRegisters([pragma.reg]);
  if (!scratch) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Semantic.UnsupportedOperation,
      'error',
      span,
      `Could not allocate scratch registers for transpose on '${pragma.reg}'.`,
      'Use a target profile with at least two general-purpose registers besides the transposed register.'
    ));
    return [];
  }

  const [tmpA, tmpB] = scratch;
  const cycles: CycleAst[] = [];
  const n = grid.rows;

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a: RoutePoint = { row: i, col: j };
      const b: RoutePoint = { row: j, col: i };

      const forwardCycles = buildRouteTransferCycles(
        a,
        b,
        pragma.reg,
        tmpA,
        startIndex + cycles.length,
        grid,
        span,
        diagnostics
      );
      cycles.push(...forwardCycles);

      const backwardCycles = buildRouteTransferCycles(
        b,
        a,
        pragma.reg,
        tmpB,
        startIndex + cycles.length,
        grid,
        span,
        diagnostics
      );
      cycles.push(...backwardCycles);

      cycles.push(createMultiAtCycle(
        startIndex + cycles.length,
        [
          { row: b.row, col: b.col, instruction: createInstruction('SADD', [pragma.reg, tmpA, 'ZERO'], span) },
          { row: a.row, col: a.col, instruction: createInstruction('SADD', [pragma.reg, tmpB, 'ZERO'], span) }
        ],
        span
      ));
    }
  }

  return cycles;
}
