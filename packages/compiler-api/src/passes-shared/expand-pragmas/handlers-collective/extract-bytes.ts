import {
  ErrorCodes,
  makeDiagnostic
} from '@castm/compiler-ir';
import {
  parseExtractBytesPragmaArgs
} from '../../advanced-args.js';
import {
  buildExtractBytesCycles
} from '../../collective-builders.js';
import {
  PragmaHandler
} from '../types.js';

export const handleExtractBytes: PragmaHandler = (pragma, ctx) => {
  const parsed = parseExtractBytesPragmaArgs(pragma.text);
  if (!parsed) {
    ctx.diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      pragma.span,
      `Invalid extract_bytes statement syntax: '${pragma.text}'.`,
      'Use extract_bytes(src=R0, dest=R1[, axis=row|col, byteWidth=8, mask=255]).'
    ));
    return;
  }

  const cycles = buildExtractBytesCycles(
    parsed,
    ctx.generatedCycles.length,
    ctx.grid,
    pragma.span,
    ctx.diagnostics
  );
  ctx.generatedCycles.push(...cycles);
};
