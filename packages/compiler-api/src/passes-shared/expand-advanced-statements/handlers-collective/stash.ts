import {
  ErrorCodes,
  makeDiagnostic
} from '@castm/compiler-ir';
import {
  parseStashAdvancedStatementArgs
} from '../../advanced-args.js';
import {
  buildStashBundles
} from '../../collective-builders.js';
import {
  AdvancedStatementHandler
} from '../types.js';

export const handleStash: AdvancedStatementHandler = (advancedStatement, ctx) => {
  const parsed = parseStashAdvancedStatementArgs(advancedStatement.text);
  if (!parsed) {
    ctx.diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      advancedStatement.span,
      `Invalid stash statement syntax: '${advancedStatement.text}'.`,
      'Use stash(action=save|restore, reg=R0, addr=<memory>, target=all|row(N)|col(N)|point(r,c)).'
    ));
    return;
  }

  const bundles = buildStashBundles(
    parsed,
    ctx.generatedBundles.length,
    ctx.grid,
    advancedStatement.span,
    ctx.diagnostics
  );
  ctx.generatedBundles.push(...bundles);
};
