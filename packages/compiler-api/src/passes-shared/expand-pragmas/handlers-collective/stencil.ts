import {
  ErrorCodes,
  makeDiagnostic
} from '@castm/compiler-ir';
import {
  parseStencilPragmaArgs
} from '../../advanced-args.js';
import {
  buildStencilCycles
} from '../../collective-builders.js';
import {
  PragmaHandler
} from '../types.js';

export const handleStencil: PragmaHandler = (pragma, ctx) => {
  const parsed = parseStencilPragmaArgs(pragma.text);
  if (!parsed) {
    ctx.diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      pragma.span,
      `Invalid stencil statement syntax: '${pragma.text}'.`,
      'Use stencil(pattern, srcReg, destReg) or stencil(pattern, operation, srcReg, destReg).'
    ));
    return;
  }

  const cycles = buildStencilCycles(
    parsed,
    ctx.generatedCycles.length,
    ctx.grid,
    pragma.span,
    ctx.diagnostics
  );
  ctx.generatedCycles.push(...cycles);
};
