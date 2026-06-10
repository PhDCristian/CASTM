import {
  ErrorCodes,
  makeDiagnostic
} from '@castm/compiler-ir';
import {
  parseScanAdvancedStatementArgs
} from '../../advanced-args.js';
import {
  buildScanBundles
} from '../../collective-builders.js';
import {
  AdvancedStatementHandler
} from '../types.js';

export const handleScan: AdvancedStatementHandler = (advancedStatement, ctx) => {
  const parsed = parseScanAdvancedStatementArgs(advancedStatement.text);
  if (!parsed) {
    ctx.diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      advancedStatement.span,
      `Invalid scan statement syntax: '${advancedStatement.text}'.`,
      'Use scan(op=add, src=R0, dest=R1, dir=left|right|up|down[, mode=inclusive|exclusive]).'
    ));
    return;
  }

  const bundles = buildScanBundles(
    parsed,
    ctx.generatedBundles.length,
    ctx.grid,
    advancedStatement.span,
    ctx.diagnostics
  );
  ctx.generatedBundles.push(...bundles);
};
