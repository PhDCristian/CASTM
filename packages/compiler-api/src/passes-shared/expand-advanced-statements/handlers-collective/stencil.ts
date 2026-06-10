import {
  ErrorCodes,
  makeDiagnostic
} from '@castm/compiler-ir';
import {
  parseStencilAdvancedStatementArgs
} from '../../advanced-args.js';
import {
  buildStencilBundles
} from '../../collective-builders.js';
import {
  AdvancedStatementHandler
} from '../types.js';

export const handleStencil: AdvancedStatementHandler = (advancedStatement, ctx) => {
  const parsed = parseStencilAdvancedStatementArgs(advancedStatement.text);
  if (!parsed) {
    ctx.diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      advancedStatement.span,
      `Invalid stencil statement syntax: '${advancedStatement.text}'.`,
      'Use stencil(pattern, srcReg, destReg) or stencil(pattern, operation, srcReg, destReg).'
    ));
    return;
  }

  const bundles = buildStencilBundles(
    parsed,
    ctx.generatedBundles.length,
    ctx.grid,
    advancedStatement.span,
    ctx.diagnostics
  );
  ctx.generatedBundles.push(...bundles);
};
