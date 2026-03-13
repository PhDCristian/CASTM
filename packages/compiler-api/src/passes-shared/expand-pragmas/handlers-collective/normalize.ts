import {
  ErrorCodes,
  makeDiagnostic
} from '@castm/compiler-ir';
import {
  parseNormalizePragmaArgs
} from '../../advanced-args.js';
import {
  buildNormalizeCycles
} from '../../collective-builders.js';
import {
  PragmaHandler
} from '../types.js';

export const handleNormalize: PragmaHandler = (pragma, ctx) => {
  const parsed = parseNormalizePragmaArgs(pragma.text);
  if (!parsed) {
    ctx.diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      pragma.span,
      `Invalid normalize statement syntax: '${pragma.text}'.`,
      'Use normalize(reg=R3, carry=R1, width=16, lane=0[, mask=65535, axis=row|col, dir=right|left|down|up]).'
    ));
    return;
  }

  const cycles = buildNormalizeCycles(
    parsed,
    ctx.generatedCycles.length,
    ctx.grid,
    pragma.span,
    ctx.diagnostics
  );
  ctx.generatedCycles.push(...cycles);
};
