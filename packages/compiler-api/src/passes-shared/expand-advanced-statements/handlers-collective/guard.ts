import {
  ErrorCodes,
  makeDiagnostic
} from '@castm/compiler-ir';
import {
  parseGuardAdvancedStatementArgs
} from '../../advanced-args.js';
import {
  buildGuardBundles
} from '../../collective-builders.js';
import {
  AdvancedStatementHandler
} from '../types.js';

export const handleGuard: AdvancedStatementHandler = (advancedStatement, ctx) => {
  const parsed = parseGuardAdvancedStatementArgs(advancedStatement.text);
  if (!parsed) {
    ctx.diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      advancedStatement.span,
      `Invalid guard statement syntax: '${advancedStatement.text}'.`,
      'Use guard(cond=<expr>, op=OPCODE, dest=R2, srcA=R0, srcB=R1).'
    ));
    return;
  }

  const bundles = buildGuardBundles(
    parsed,
    ctx.generatedBundles.length,
    ctx.grid,
    advancedStatement.span,
    ctx.diagnostics
  );
  ctx.generatedBundles.push(...bundles);
};
