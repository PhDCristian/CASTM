import {
  BundleAst,
  Diagnostic,
  GridSpec,
  SourceSpan
} from '@castm/compiler-ir';
import { AllreduceAdvancedStatementArgs } from '../advanced-args.js';
import { buildBroadcastBundles } from '../route-builders.js';
import { buildReduceBundles } from '../collective-scan-reduce.js';

export function buildAllreduceBundles(
  advancedStatement: AllreduceAdvancedStatementArgs,
  startIndex: number,
  grid: GridSpec,
  span: SourceSpan,
  diagnostics: Diagnostic[]
): BundleAst[] {
  const reduceBefore = diagnostics.length;
  const reduceBundles = buildReduceBundles(
    {
      operation: advancedStatement.operation,
      destReg: advancedStatement.destReg,
      srcReg: advancedStatement.srcReg,
      axis: advancedStatement.axis
    },
    startIndex,
    grid,
    span,
    diagnostics
  );

  if (diagnostics.length > reduceBefore && reduceBundles.length === 0) {
    return [];
  }

  const broadcastBundles = buildBroadcastBundles(
    {
      valueReg: advancedStatement.destReg,
      from: { row: 0, col: 0 },
      scope: advancedStatement.axis === 'col' ? 'column' : 'row'
    },
    startIndex + reduceBundles.length,
    grid,
    span,
    diagnostics
  );

  return [...reduceBundles, ...broadcastBundles];
}
