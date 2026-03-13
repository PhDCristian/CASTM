import {
  ErrorCodes,
  makeDiagnostic
} from '@castm/compiler-ir';
import {
  parseMulaccChainPragmaArgs
} from '../../advanced-args.js';
import {
  buildMulaccChainCycles
} from '../../collective-builders.js';
import {
  PragmaHandler
} from '../types.js';

export const handleMulaccChain: PragmaHandler = (pragma, ctx) => {
  const parsed = parseMulaccChainPragmaArgs(pragma.text);
  if (!parsed) {
    ctx.diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      pragma.span,
      `Invalid mulacc_chain statement syntax: '${pragma.text}'.`,
      'Use mulacc_chain(src=R0, coeff=R1, acc=R3, out=R0, target=row(0), width=16, dir=right[, lanes=4, mask=65535]).'
    ));
    return;
  }

  const cycles = buildMulaccChainCycles(
    parsed,
    ctx.generatedCycles.length,
    ctx.grid,
    pragma.span,
    ctx.diagnostics
  );
  ctx.generatedCycles.push(...cycles);
};
