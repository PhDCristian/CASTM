import {
  ErrorCodes,
  makeDiagnostic
} from '@castm/compiler-ir';
import {
  parseCollectAdvancedStatementArgs
} from '../../advanced-args.js';
import {
  buildCollectBundles
} from '../../collective-builders.js';
import {
  AdvancedStatementHandler
} from '../types.js';

export const handleCollect: AdvancedStatementHandler = (advancedStatement, ctx) => {
  const parsed = parseCollectAdvancedStatementArgs(advancedStatement.text);
  if (!parsed) {
    ctx.diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      advancedStatement.span,
      `Invalid collect statement syntax: '${advancedStatement.text}'.`,
      'Use collect(from=row(N)|col(N), to=row(M)|col(M), via=RCB|RCT|RCL|RCR|SELF, local=R2, into=R3[, combine=add|sum|sub|and|or|xor|mul|copy|shift_add][, path=single_hop|multi_hop][, max_hops=K]).'
    ));
    return;
  }

  const bundles = buildCollectBundles(
    parsed,
    ctx.generatedBundles.length,
    ctx.grid,
    advancedStatement.span,
    ctx.diagnostics
  );
  ctx.generatedBundles.push(...bundles);
};
