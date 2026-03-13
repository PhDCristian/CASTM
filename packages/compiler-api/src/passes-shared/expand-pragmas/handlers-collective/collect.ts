import {
  ErrorCodes,
  makeDiagnostic
} from '@castm/compiler-ir';
import {
  parseCollectPragmaArgs
} from '../../advanced-args.js';
import {
  buildCollectCycles
} from '../../collective-builders.js';
import {
  PragmaHandler
} from '../types.js';

export const handleCollect: PragmaHandler = (pragma, ctx) => {
  const parsed = parseCollectPragmaArgs(pragma.text);
  if (!parsed) {
    ctx.diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      pragma.span,
      `Invalid collect statement syntax: '${pragma.text}'.`,
      'Use collect(from=row(N)|col(N), to=row(M)|col(M), via=RCB|RCT|RCL|RCR|SELF, local=R2, into=R3[, combine=add|sum|sub|and|or|xor|mul|copy|shift_add][, path=single_hop|multi_hop][, max_hops=K]).'
    ));
    return;
  }

  const cycles = buildCollectCycles(
    parsed,
    ctx.generatedCycles.length,
    ctx.grid,
    pragma.span,
    ctx.diagnostics
  );
  ctx.generatedCycles.push(...cycles);
};
