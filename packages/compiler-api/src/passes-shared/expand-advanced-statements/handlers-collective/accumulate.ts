import {
  ErrorCodes,
  makeDiagnostic
} from '@castm/compiler-ir';
import {
  parseAccumulateAdvancedStatementArgs
} from '../../advanced-args.js';
import {
  buildAccumulateBundles
} from '../../collective-builders.js';
import {
  AdvancedStatementHandler
} from '../types.js';

export const handleAccumulate: AdvancedStatementHandler = (advancedStatement, ctx) => {
  const parsed = parseAccumulateAdvancedStatementArgs(advancedStatement.text);
  if (!parsed) {
    ctx.diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      advancedStatement.span,
      `Invalid accumulate statement syntax: '${advancedStatement.text}'.`,
      'Use accumulate(pattern=row|col|anti_diagonal, products=R2, accum=R3, out=ROUT[, combine=add|sum|sub|and|or|xor|mul][, steps=1][, scope=all|row(i)|col(j)]).'
    ));
    return;
  }

  const bundles = buildAccumulateBundles(
    parsed,
    ctx.generatedBundles.length,
    ctx.grid,
    advancedStatement.span,
    ctx.diagnostics
  );
  ctx.generatedBundles.push(...bundles);
};
