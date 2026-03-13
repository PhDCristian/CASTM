import {
  ErrorCodes,
  makeDiagnostic
} from '@castm/compiler-ir';
import {
  parseAllreducePragmaArgs
} from '../../advanced-args.js';
import {
  buildAllreduceCycles
} from '../../collective-builders.js';
import {
  PragmaHandler
} from '../types.js';

export const handleAllreduce: PragmaHandler = (pragma, ctx) => {
  const parsed = parseAllreducePragmaArgs(pragma.text);
  if (!parsed) {
    ctx.diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      pragma.span,
      `Invalid allreduce statement syntax: '${pragma.text}'.`,
      'Use allreduce(op=add|sum|and|or, dest=R1, src=R0[, axis=row|col]).'
    ));
    return;
  }

  const cycles = buildAllreduceCycles(
    parsed,
    ctx.generatedCycles.length,
    ctx.grid,
    pragma.span,
    ctx.diagnostics
  );
  ctx.generatedCycles.push(...cycles);
};
