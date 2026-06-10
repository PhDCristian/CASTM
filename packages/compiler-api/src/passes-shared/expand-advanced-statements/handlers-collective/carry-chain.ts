import {
  ErrorCodes,
  makeDiagnostic
} from '@castm/compiler-ir';
import {
  parseCarryChainAdvancedStatementArgs
} from '../../advanced-args.js';
import {
  buildCarryChainBundles
} from '../../collective-builders.js';
import {
  AdvancedStatementHandler
} from '../types.js';

export const handleCarryChain: AdvancedStatementHandler = (advancedStatement, ctx) => {
  const parsed = parseCarryChainAdvancedStatementArgs(advancedStatement.text);
  if (!parsed) {
    ctx.diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      advancedStatement.span,
      `Invalid carry_chain statement syntax: '${advancedStatement.text}'.`,
      'Use carry_chain(src=R0, carry=R3, store=L, limbs=4, width=16, row=0[, mask=65535, start=0, dir=right|left]).'
    ));
    return;
  }

  const bundles = buildCarryChainBundles(
    parsed,
    ctx.generatedBundles.length,
    ctx.grid,
    advancedStatement.span,
    ctx.diagnostics
  );
  ctx.generatedBundles.push(...bundles);
};
