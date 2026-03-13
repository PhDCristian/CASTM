import {
  ErrorCodes,
  makeDiagnostic
} from '@castm/compiler-ir';
import {
  parseGuardPragmaArgs
} from '../../advanced-args.js';
import {
  buildGuardCycles
} from '../../collective-builders.js';
import {
  PragmaHandler
} from '../types.js';

export const handleGuard: PragmaHandler = (pragma, ctx) => {
  const parsed = parseGuardPragmaArgs(pragma.text);
  if (!parsed) {
    ctx.diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      pragma.span,
      `Invalid guard statement syntax: '${pragma.text}'.`,
      'Use guard(cond=<expr>, op=OPCODE, dest=R2, srcA=R0, srcB=R1).'
    ));
    return;
  }

  const cycles = buildGuardCycles(
    parsed,
    ctx.generatedCycles.length,
    ctx.grid,
    pragma.span,
    ctx.diagnostics
  );
  ctx.generatedCycles.push(...cycles);
};
