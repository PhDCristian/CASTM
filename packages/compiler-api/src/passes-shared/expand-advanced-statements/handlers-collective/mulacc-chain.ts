import {
  ErrorCodes,
  makeDiagnostic
} from '@castm/compiler-ir';
import {
  parseMulaccChainAdvancedStatementArgs
} from '../../advanced-args.js';
import {
  buildMulaccChainBundles
} from '../../collective-builders.js';
import {
  AdvancedStatementHandler
} from '../types.js';

export const handleMulaccChain: AdvancedStatementHandler = (advancedStatement, ctx) => {
  const parsed = parseMulaccChainAdvancedStatementArgs(advancedStatement.text);
  if (!parsed) {
    ctx.diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      advancedStatement.span,
      `Invalid mulacc_chain statement syntax: '${advancedStatement.text}'.`,
      'Use mulacc_chain(src=R0, coeff=R1, acc=R3, out=R0, target=row(0), width=16, dir=right[, lanes=4, mask=65535]).'
    ));
    return;
  }

  const bundles = buildMulaccChainBundles(
    parsed,
    ctx.generatedBundles.length,
    ctx.grid,
    advancedStatement.span,
    ctx.diagnostics
  );
  ctx.generatedBundles.push(...bundles);
};
