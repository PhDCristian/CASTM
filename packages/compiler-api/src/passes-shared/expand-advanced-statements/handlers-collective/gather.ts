import {
  ErrorCodes,
  makeDiagnostic
} from '@castm/compiler-ir';
import {
  parseGatherAdvancedStatementArgs
} from '../../advanced-args.js';
import {
  buildGatherBundles
} from '../../collective-builders.js';
import {
  AdvancedStatementHandler
} from '../types.js';

export const handleGather: AdvancedStatementHandler = (advancedStatement, ctx) => {
  const parsed = parseGatherAdvancedStatementArgs(advancedStatement.text);
  if (!parsed) {
    ctx.diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      advancedStatement.span,
      `Invalid gather statement syntax: '${advancedStatement.text}'.`,
      'Use gather(src=R0, dest=@row,col, destReg=R1, op=add).'
    ));
    return;
  }

  const bundles = buildGatherBundles(
    parsed,
    ctx.generatedBundles.length,
    ctx.grid,
    advancedStatement.span,
    ctx.diagnostics
  );
  ctx.generatedBundles.push(...bundles);
};
