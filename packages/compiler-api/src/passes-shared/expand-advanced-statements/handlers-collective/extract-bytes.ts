import {
  ErrorCodes,
  makeDiagnostic
} from '@castm/compiler-ir';
import {
  parseExtractBytesAdvancedStatementArgs
} from '../../advanced-args.js';
import {
  buildExtractBytesBundles
} from '../../collective-builders.js';
import {
  AdvancedStatementHandler
} from '../types.js';

export const handleExtractBytes: AdvancedStatementHandler = (advancedStatement, ctx) => {
  const parsed = parseExtractBytesAdvancedStatementArgs(advancedStatement.text);
  if (!parsed) {
    ctx.diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      advancedStatement.span,
      `Invalid extract_bytes statement syntax: '${advancedStatement.text}'.`,
      'Use extract_bytes(src=R0, dest=R1[, axis=row|col, byteWidth=8, mask=255]).'
    ));
    return;
  }

  const bundles = buildExtractBytesBundles(
    parsed,
    ctx.generatedBundles.length,
    ctx.grid,
    advancedStatement.span,
    ctx.diagnostics
  );
  ctx.generatedBundles.push(...bundles);
};
