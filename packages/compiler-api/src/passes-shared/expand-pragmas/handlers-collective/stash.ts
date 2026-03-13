import {
  ErrorCodes,
  makeDiagnostic
} from '@castm/compiler-ir';
import {
  parseStashPragmaArgs
} from '../../advanced-args.js';
import {
  buildStashCycles
} from '../../collective-builders.js';
import {
  PragmaHandler
} from '../types.js';

export const handleStash: PragmaHandler = (pragma, ctx) => {
  const parsed = parseStashPragmaArgs(pragma.text);
  if (!parsed) {
    ctx.diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      pragma.span,
      `Invalid stash statement syntax: '${pragma.text}'.`,
      'Use stash(action=save|restore, reg=R0, addr=<memory>, target=all|row(N)|col(N)|point(r,c)).'
    ));
    return;
  }

  const cycles = buildStashCycles(
    parsed,
    ctx.generatedCycles.length,
    ctx.grid,
    pragma.span,
    ctx.diagnostics
  );
  ctx.generatedCycles.push(...cycles);
};
