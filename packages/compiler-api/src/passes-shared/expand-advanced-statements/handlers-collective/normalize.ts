import {
  ErrorCodes,
  makeDiagnostic
} from '@castm/compiler-ir';
import {
  parseNormalizeAdvancedStatementArgs
} from '../../advanced-args.js';
import {
  buildNormalizeBundles
} from '../../collective-builders.js';
import {
  AdvancedStatementHandler
} from '../types.js';

export const handleNormalize: AdvancedStatementHandler = (advancedStatement, ctx) => {
  const parsed = parseNormalizeAdvancedStatementArgs(advancedStatement.text);
  if (!parsed) {
    ctx.diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      advancedStatement.span,
      `Invalid normalize statement syntax: '${advancedStatement.text}'.`,
      'Use normalize(reg=R3, carry=R1, width=16, lane=0[, mask=65535, axis=row|col, dir=right|left|down|up]).'
    ));
    return;
  }

  const bundles = buildNormalizeBundles(
    parsed,
    ctx.generatedBundles.length,
    ctx.grid,
    advancedStatement.span,
    ctx.diagnostics
  );
  ctx.generatedBundles.push(...bundles);
};
