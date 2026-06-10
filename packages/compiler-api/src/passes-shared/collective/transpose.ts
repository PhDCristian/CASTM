import {
  BundleAst,
  Diagnostic,
  ErrorCodes,
  GridSpec,
  SourceSpan,
  makeDiagnostic
} from '@castm/compiler-ir';
import {
  createInstruction,
  createMultiAtBundle
} from '../ast-utils.js';
import { TransposeAdvancedStatementArgs } from '../advanced-args.js';
import { RoutePoint } from '../route-args.js';
import { buildRouteTransferBundles } from '../route-builders.js';
import { pickScratchRegisters } from '../collective-scan-reduce.js';

export function buildTransposeBundles(
  advancedStatement: TransposeAdvancedStatementArgs,
  startIndex: number,
  grid: GridSpec,
  span: SourceSpan,
  diagnostics: Diagnostic[]
): BundleAst[] {
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

  const scratch = pickScratchRegisters([advancedStatement.reg]);
  if (!scratch) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Semantic.UnsupportedOperation,
      'error',
      span,
      `Could not allocate scratch registers for transpose on '${advancedStatement.reg}'.`,
      'Use a target profile with at least two general-purpose registers besides the transposed register.'
    ));
    return [];
  }

  const [tmpA, tmpB] = scratch;
  const bundles: BundleAst[] = [];
  const n = grid.rows;

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a: RoutePoint = { row: i, col: j };
      const b: RoutePoint = { row: j, col: i };

      const forwardBundles = buildRouteTransferBundles(
        a,
        b,
        advancedStatement.reg,
        tmpA,
        startIndex + bundles.length,
        grid,
        span,
        diagnostics
      );
      bundles.push(...forwardBundles);

      const backwardBundles = buildRouteTransferBundles(
        b,
        a,
        advancedStatement.reg,
        tmpB,
        startIndex + bundles.length,
        grid,
        span,
        diagnostics
      );
      bundles.push(...backwardBundles);

      bundles.push(createMultiAtBundle(
        startIndex + bundles.length,
        [
          { row: b.row, col: b.col, instruction: createInstruction('SADD', [advancedStatement.reg, tmpA, 'ZERO'], span) },
          { row: a.row, col: a.col, instruction: createInstruction('SADD', [advancedStatement.reg, tmpB, 'ZERO'], span) }
        ],
        span
      ));
    }
  }

  return bundles;
}
