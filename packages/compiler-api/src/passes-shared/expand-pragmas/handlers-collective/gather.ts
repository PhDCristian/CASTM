import {
  ErrorCodes,
  makeDiagnostic
} from '@castm/compiler-ir';
import {
  parseGatherPragmaArgs
} from '../../advanced-args.js';
import {
  buildGatherCycles
} from '../../collective-builders.js';
import {
  PragmaHandler
} from '../types.js';

export const handleGather: PragmaHandler = (pragma, ctx) => {
  const parsed = parseGatherPragmaArgs(pragma.text);
  if (!parsed) {
    ctx.diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      pragma.span,
      `Invalid gather statement syntax: '${pragma.text}'.`,
      'Use gather(src=R0, dest=@row,col, destReg=R1, op=add).'
    ));
    return;
  }

  const cycles = buildGatherCycles(
    parsed,
    ctx.generatedCycles.length,
    ctx.grid,
    pragma.span,
    ctx.diagnostics
  );
  ctx.generatedCycles.push(...cycles);
};
