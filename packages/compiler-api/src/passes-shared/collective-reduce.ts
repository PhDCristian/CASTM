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
} from './ast-utils.js';
import { ReduceAdvancedStatementArgs } from './advanced-args.js';
import { RoutePoint } from './route-args.js';
import { buildRouteTransferBundles } from './route-builders.js';
import {
  getReduceOpcode,
  pickScratchRegisters
} from './collective-scan-reduce-helpers.js';

export function buildReduceBundles(
  advancedStatement: ReduceAdvancedStatementArgs,
  startIndex: number,
  grid: GridSpec,
  span: SourceSpan,
  diagnostics: Diagnostic[]
): BundleAst[] {
  const compareOp = advancedStatement.operation === 'max' || advancedStatement.operation === 'min';
  const simpleOpcode = getReduceOpcode(advancedStatement.operation);
  if (!compareOp && !simpleOpcode) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Semantic.UnsupportedOperation,
      'error',
      span,
      `Unsupported reduce operation '${advancedStatement.operation}'.`,
      'Supported operations: sum, add, and, or, xor, mul, max, min.'
    ));
    return [];
  }

  const lanes = advancedStatement.axis === 'row' ? grid.cols : grid.rows;
  if (lanes <= 0) {
    return [];
  }

  const scratch = pickScratchRegisters([advancedStatement.srcReg, advancedStatement.destReg]);
  if (!scratch) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Semantic.UnsupportedOperation,
      'error',
      span,
      `Could not allocate scratch registers for reduce destination '${advancedStatement.destReg}'.`,
      'Use a target profile with temporary registers available.'
    ));
    return [];
  }

  const relayReg = scratch[0];
  const cmpReg = scratch[1];
  const anchor: RoutePoint = { row: 0, col: 0 };
  const sources: RoutePoint[] = [];
  for (let i = 1; i < lanes; i++) {
    sources.push(
      advancedStatement.axis === 'row'
        ? { row: 0, col: i }
        : { row: i, col: 0 }
    );
  }
  sources.sort((a, b) => {
    const da = Math.abs(a.row - anchor.row) + Math.abs(a.col - anchor.col);
    const db = Math.abs(b.row - anchor.row) + Math.abs(b.col - anchor.col);
    if (da !== db) return da - db;
    if (a.row !== b.row) return a.row - b.row;
    return a.col - b.col;
  });

  const bundles: BundleAst[] = [];
  bundles.push(createAtBundle(
    startIndex + bundles.length,
    anchor.row,
    anchor.col,
    createInstruction('SADD', [advancedStatement.destReg, advancedStatement.srcReg, 'ZERO'], span),
    span
  ));

  for (const source of sources) {
    const transfer = buildRouteTransferBundles(
      source,
      anchor,
      advancedStatement.srcReg,
      relayReg,
      startIndex + bundles.length,
      grid,
      span,
      diagnostics
    );
    bundles.push(...transfer);

    if (!compareOp && simpleOpcode) {
      bundles.push(createAtBundle(
        startIndex + bundles.length,
        anchor.row,
        anchor.col,
        createInstruction(simpleOpcode, [advancedStatement.destReg, advancedStatement.destReg, relayReg], span),
        span
      ));
      continue;
    }

    bundles.push(createAtBundle(
      startIndex + bundles.length,
      anchor.row,
      anchor.col,
      createInstruction('SSUB', [cmpReg, advancedStatement.destReg, relayReg], span),
      span
    ));

    const first = advancedStatement.operation === 'max' ? relayReg : advancedStatement.destReg;
    const second = advancedStatement.operation === 'max' ? advancedStatement.destReg : relayReg;
    bundles.push(createAtBundle(
      startIndex + bundles.length,
      anchor.row,
      anchor.col,
      createInstruction('BSFA', [advancedStatement.destReg, first, second, 'SELF'], span),
      span
    ));
  }

  return bundles;
}
