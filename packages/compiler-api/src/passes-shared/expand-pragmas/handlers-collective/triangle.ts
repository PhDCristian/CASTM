import {
  ErrorCodes,
  makeDiagnostic
} from '@castm/compiler-ir';
import {
  parseTrianglePragmaArgs
} from '../../advanced-args.js';
import {
  buildTriangleCycles
} from '../../collective-builders.js';
import {
  PragmaHandler
} from '../types.js';

export const handleTriangle: PragmaHandler = (pragma, ctx) => {
  const parsed = parseTrianglePragmaArgs(pragma.text);
  if (!parsed) {
    ctx.diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      pragma.span,
      `Invalid triangle statement syntax: '${pragma.text}'.`,
      'Use triangle(shape=upper|lower, inclusive=true|false, op=SMUL, dest=R2, srcA=R0, srcB=R1).'
    ));
    return;
  }

  const cycles = buildTriangleCycles(
    parsed,
    ctx.generatedCycles.length,
    ctx.grid,
    pragma.span
  );
  ctx.generatedCycles.push(...cycles);
};
