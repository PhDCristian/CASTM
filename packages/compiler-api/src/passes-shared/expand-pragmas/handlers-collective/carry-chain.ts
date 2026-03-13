import {
  ErrorCodes,
  makeDiagnostic
} from '@castm/compiler-ir';
import {
  parseCarryChainPragmaArgs
} from '../../advanced-args.js';
import {
  buildCarryChainCycles
} from '../../collective-builders.js';
import {
  PragmaHandler
} from '../types.js';

export const handleCarryChain: PragmaHandler = (pragma, ctx) => {
  const parsed = parseCarryChainPragmaArgs(pragma.text);
  if (!parsed) {
    ctx.diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      pragma.span,
      `Invalid carry_chain statement syntax: '${pragma.text}'.`,
      'Use carry_chain(src=R0, carry=R3, store=L, limbs=4, width=16, row=0[, mask=65535, start=0, dir=right|left]).'
    ));
    return;
  }

  const cycles = buildCarryChainCycles(
    parsed,
    ctx.generatedCycles.length,
    ctx.grid,
    pragma.span,
    ctx.diagnostics
  );
  ctx.generatedCycles.push(...cycles);
};
