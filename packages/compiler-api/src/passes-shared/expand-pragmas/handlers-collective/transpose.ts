import {
  ErrorCodes,
  makeDiagnostic
} from '@castm/compiler-ir';
import {
  parseTransposePragmaArgs
} from '../../advanced-args.js';
import {
  buildTransposeCycles
} from '../../collective-builders.js';
import {
  PragmaHandler
} from '../types.js';

export const handleTranspose: PragmaHandler = (pragma, ctx) => {
  const parsed = parseTransposePragmaArgs(pragma.text);
  if (!parsed) {
    ctx.diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      pragma.span,
      `Invalid transpose statement syntax: '${pragma.text}'.`,
      'Use transpose(reg=R0).'
    ));
    return;
  }

  const cycles = buildTransposeCycles(
    parsed,
    ctx.generatedCycles.length,
    ctx.grid,
    pragma.span,
    ctx.diagnostics
  );
  ctx.generatedCycles.push(...cycles);
};
