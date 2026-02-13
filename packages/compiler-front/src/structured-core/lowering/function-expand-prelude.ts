import { Diagnostic, ErrorCodes, KernelAst, WarningCodes, makeDiagnostic, spanAt } from '@openedge/compiler-ir';
import { parseAdvancedNamespaceIssue, parseStandardAdvancedCall } from './statements.js';
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
      `Non-canonical pragma syntax is not supported: '${clean}'.`,
      'Use canonical statements (for example route(...), reduce(...), scan(...)) and explicit control-flow syntax.'
    ));
    return true;
  }

  const namespaceIssue = parseAdvancedNamespaceIssue(clean);
  if (namespaceIssue) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      spanAt(entry.lineNo, 1, clean.length),
      `Unsupported advanced namespace '${namespaceIssue.namespace}::${namespaceIssue.name}(...)'.`,
      `Use std::${namespaceIssue.name}(...) for standard advanced statements.`
    ));
    return true;
  }

  const advancedPragma = parseStandardAdvancedCall(clean);
  if (!advancedPragma) {
    return false;
  }

  if (advancedPragma.sourceForm === 'unqualified') {
    diagnostics.push(makeDiagnostic(
      WarningCodes.Style.UnqualifiedStdBuiltin,
      'warning',
      spanAt(entry.lineNo, 1, clean.length),
      `Unqualified standard statement '${advancedPragma.name}(...)' is deprecated.`,
      `Use std::${advancedPragma.name}(...) instead.`,
      'MIG-STD-001'
    ));
  }

  kernel.pragmas.push({
    text: advancedPragma.text,
    anchorCycleIndex: Array.isArray(kernel.cycles) ? kernel.cycles.length : 0,
    span: spanAt(entry.lineNo, 1, clean.length)
  });
  return true;
}
