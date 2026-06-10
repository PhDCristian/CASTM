import {
  ErrorCodes,
  makeDiagnostic
} from '@castm/compiler-ir';
import {
  parseReduceAdvancedStatementArgs
} from '../../advanced-args.js';
import {
  buildReduceBundles
} from '../../collective-builders.js';
import {
  AdvancedStatementHandler
} from '../types.js';

export const handleReduce: AdvancedStatementHandler = (advancedStatement, ctx) => {
  const parsed = parseReduceAdvancedStatementArgs(advancedStatement.text);
  if (!parsed) {
    ctx.diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      advancedStatement.span,
      `Invalid reduce statement syntax: '${advancedStatement.text}'.`,
      'Use reduce(op=add|sum|and|or, dest=R1, src=R0[, axis=row|col]).'
    ));
    return;
  }

  const bundles = buildReduceBundles(
    parsed,
    ctx.generatedBundles.length,
    ctx.grid,
    advancedStatement.span,
    ctx.diagnostics
  );
  ctx.generatedBundles.push(...bundles);
};
