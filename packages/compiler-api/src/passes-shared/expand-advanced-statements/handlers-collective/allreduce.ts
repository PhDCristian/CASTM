import {
  ErrorCodes,
  makeDiagnostic
} from '@castm/compiler-ir';
import {
  parseAllreduceAdvancedStatementArgs
} from '../../advanced-args.js';
import {
  buildAllreduceBundles
} from '../../collective-builders.js';
import {
  AdvancedStatementHandler
} from '../types.js';

export const handleAllreduce: AdvancedStatementHandler = (advancedStatement, ctx) => {
  const parsed = parseAllreduceAdvancedStatementArgs(advancedStatement.text);
  if (!parsed) {
    ctx.diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      advancedStatement.span,
      `Invalid allreduce statement syntax: '${advancedStatement.text}'.`,
      'Use allreduce(op=add|sum|and|or, dest=R1, src=R0[, axis=row|col]).'
    ));
    return;
  }

  const bundles = buildAllreduceBundles(
    parsed,
    ctx.generatedBundles.length,
    ctx.grid,
    advancedStatement.span,
    ctx.diagnostics
  );
  ctx.generatedBundles.push(...bundles);
};
