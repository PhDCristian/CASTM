import {
  ErrorCodes,
  makeDiagnostic
} from '@castm/compiler-ir';
import {
  parseAccumulatePragmaArgs
} from '../../advanced-args.js';
import {
  buildAccumulateCycles
} from '../../collective-builders.js';
import {
  PragmaHandler
} from '../types.js';

export const handleAccumulate: PragmaHandler = (pragma, ctx) => {
  const parsed = parseAccumulatePragmaArgs(pragma.text);
  if (!parsed) {
    ctx.diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      pragma.span,
      `Invalid accumulate statement syntax: '${pragma.text}'.`,
      'Use accumulate(pattern=row|col|anti_diagonal, products=R2, accum=R3, out=ROUT[, combine=add|sum|sub|and|or|xor|mul][, steps=1][, scope=all|row(i)|col(j)]).'
    ));
    return;
  }

  const cycles = buildAccumulateCycles(
    parsed,
    ctx.generatedCycles.length,
    ctx.grid,
    pragma.span,
    ctx.diagnostics
  );
  ctx.generatedCycles.push(...cycles);
};
