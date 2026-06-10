import {
  ErrorCodes,
  makeDiagnostic
} from '@castm/compiler-ir';
import {
  parseConditionalSubAdvancedStatementArgs
} from '../../advanced-args.js';
import {
  buildConditionalSubBundles
} from '../../collective-builders.js';
import {
  AdvancedStatementHandler
} from '../types.js';

export const handleConditionalSub: AdvancedStatementHandler = (advancedStatement, ctx) => {
  const parsed = parseConditionalSubAdvancedStatementArgs(advancedStatement.text);
  if (!parsed) {
    ctx.diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      advancedStatement.span,
      `Invalid conditional_sub statement syntax: '${advancedStatement.text}'.`,
      'Use conditional_sub(value=R0, sub=R1, dest=R2[, target=all|row(N)|col(N)|point(r,c)]).'
    ));
    return;
  }

  const bundles = buildConditionalSubBundles(
    parsed,
    ctx.generatedBundles.length,
    ctx.grid,
    advancedStatement.span,
    ctx.diagnostics
  );
  ctx.generatedBundles.push(...bundles);
};
