import {
  ErrorCodes,
  makeDiagnostic
} from '@castm/compiler-ir';
import {
  parseReducePragmaArgs
} from '../../advanced-args.js';
import {
  buildReduceCycles
} from '../../collective-builders.js';
import {
  PragmaHandler
} from '../types.js';

export const handleReduce: PragmaHandler = (pragma, ctx) => {
  const parsed = parseReducePragmaArgs(pragma.text);
  if (!parsed) {
    ctx.diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      pragma.span,
      `Invalid reduce statement syntax: '${pragma.text}'.`,
      'Use reduce(op=add|sum|and|or, dest=R1, src=R0[, axis=row|col]).'
    ));
    return;
  }

  const cycles = buildReduceCycles(
    parsed,
    ctx.generatedCycles.length,
    ctx.grid,
    pragma.span,
    ctx.diagnostics
  );
  ctx.generatedCycles.push(...cycles);
};
