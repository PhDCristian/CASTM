import {
  ErrorCodes,
  makeDiagnostic
} from '@castm/compiler-ir';
import {
  parseTriangleAdvancedStatementArgs
} from '../../advanced-args.js';
import {
  buildTriangleBundles
} from '../../collective-builders.js';
import {
  AdvancedStatementHandler
} from '../types.js';

export const handleTriangle: AdvancedStatementHandler = (advancedStatement, ctx) => {
  const parsed = parseTriangleAdvancedStatementArgs(advancedStatement.text);
  if (!parsed) {
    ctx.diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      advancedStatement.span,
      `Invalid triangle statement syntax: '${advancedStatement.text}'.`,
      'Use triangle(shape=upper|lower, inclusive=true|false, op=SMUL, dest=R2, srcA=R0, srcB=R1).'
    ));
    return;
  }

  const bundles = buildTriangleBundles(
    parsed,
    ctx.generatedBundles.length,
    ctx.grid,
    advancedStatement.span
  );
  ctx.generatedBundles.push(...bundles);
};
