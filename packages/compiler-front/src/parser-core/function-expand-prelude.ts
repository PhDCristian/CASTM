import { Diagnostic, ErrorCodes, KernelAst, makeDiagnostic, spanAt } from '@openedge/compiler-ir';
import { parseAdvancedStatementAsPragma } from './statements.js';
import type { SourceLineEntry } from '../parser-utils/blocks.js';

export function consumeFunctionPreludeStatement(
  entry: SourceLineEntry,
  clean: string,
  kernel: KernelAst,
  diagnostics: Diagnostic[]
): boolean {
  if (/^#pragma\b/i.test(clean)) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      spanAt(entry.lineNo, 1, clean.length),
      `Legacy pragma syntax is not supported: '${clean}'.`,
      'Use canonical statements (for example route(...), reduce(...), scan(...)) and explicit control-flow syntax.'
    ));
    return true;
  }

  const advancedPragmaText = parseAdvancedStatementAsPragma(clean);
  if (!advancedPragmaText) {
    return false;
  }

  kernel.pragmas.push({
    text: advancedPragmaText,
    span: spanAt(entry.lineNo, 1, clean.length)
  });
  return true;
}
