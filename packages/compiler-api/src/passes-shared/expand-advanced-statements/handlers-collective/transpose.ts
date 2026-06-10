import {
  ErrorCodes,
  makeDiagnostic
} from '@castm/compiler-ir';
import {
  parseTransposeAdvancedStatementArgs
} from '../../advanced-args.js';
import {
  buildTransposeBundles
} from '../../collective-builders.js';
import {
  AdvancedStatementHandler
} from '../types.js';

export const handleTranspose: AdvancedStatementHandler = (advancedStatement, ctx) => {
  const parsed = parseTransposeAdvancedStatementArgs(advancedStatement.text);
  if (!parsed) {
    ctx.diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      advancedStatement.span,
      `Invalid transpose statement syntax: '${advancedStatement.text}'.`,
      'Use transpose(reg=R0).'
    ));
    return;
  }

  const bundles = buildTransposeBundles(
    parsed,
    ctx.generatedBundles.length,
    ctx.grid,
    advancedStatement.span,
    ctx.diagnostics
  );
  ctx.generatedBundles.push(...bundles);
};
