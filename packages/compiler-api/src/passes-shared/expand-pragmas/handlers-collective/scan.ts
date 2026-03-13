import {
  ErrorCodes,
  makeDiagnostic
} from '@castm/compiler-ir';
import {
  parseScanPragmaArgs
} from '../../advanced-args.js';
import {
  buildScanCycles
} from '../../collective-builders.js';
import {
  PragmaHandler
} from '../types.js';

export const handleScan: PragmaHandler = (pragma, ctx) => {
  const parsed = parseScanPragmaArgs(pragma.text);
  if (!parsed) {
    ctx.diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      pragma.span,
      `Invalid scan statement syntax: '${pragma.text}'.`,
      'Use scan(op=add, src=R0, dest=R1, dir=left|right|up|down[, mode=inclusive|exclusive]).'
    ));
    return;
  }

  const cycles = buildScanCycles(
    parsed,
    ctx.generatedCycles.length,
    ctx.grid,
    pragma.span,
    ctx.diagnostics
  );
  ctx.generatedCycles.push(...cycles);
};
