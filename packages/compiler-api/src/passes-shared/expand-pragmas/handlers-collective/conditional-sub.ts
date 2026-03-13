import {
  ErrorCodes,
  makeDiagnostic
} from '@castm/compiler-ir';
import {
  parseConditionalSubPragmaArgs
} from '../../advanced-args.js';
import {
  buildConditionalSubCycles
} from '../../collective-builders.js';
import {
  PragmaHandler
} from '../types.js';

export const handleConditionalSub: PragmaHandler = (pragma, ctx) => {
  const parsed = parseConditionalSubPragmaArgs(pragma.text);
  if (!parsed) {
    ctx.diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      pragma.span,
      `Invalid conditional_sub statement syntax: '${pragma.text}'.`,
      'Use conditional_sub(value=R0, sub=R1, dest=R2[, target=all|row(N)|col(N)|point(r,c)]).'
    ));
    return;
  }

  const cycles = buildConditionalSubCycles(
    parsed,
    ctx.generatedCycles.length,
    ctx.grid,
    pragma.span,
    ctx.diagnostics
  );
  ctx.generatedCycles.push(...cycles);
};
