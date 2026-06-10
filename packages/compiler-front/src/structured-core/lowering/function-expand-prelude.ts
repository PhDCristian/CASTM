import { Diagnostic, ErrorCodes, KernelAst, makeDiagnostic, spanAt } from '@castm/compiler-ir';
import { parseAdvancedNamespaceIssue, parseStandardAdvancedCall } from './statements.js';
import type { SourceLineEntry } from '../parser-utils/blocks.js';
import { RESERVED_KEYWORDS } from '../constants.js';

function stripLabelPrefix(clean: string): { label: string; rest: string } | null {
  const match = clean.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.+)$/);
  if (!match) return null;
  const keyword = match[1].toLowerCase();
  if (RESERVED_KEYWORDS.has(keyword)) return null;
  // Don't treat std::name() as label "std" — reject if rest starts with ':'
  if (match[2].startsWith(':')) return null;
  return { label: match[1], rest: match[2] };
}

export function consumeFunctionPreludeStatement(
  entry: SourceLineEntry,
  clean: string,
  kernel: KernelAst,
  diagnostics: Diagnostic[]
): boolean {
  // Strip optional label prefix (e.g. "subrC: std::extract_bytes(...)")
  const labelResult = stripLabelPrefix(clean);
  const toParse = labelResult ? labelResult.rest : clean;

  const namespaceIssue = parseAdvancedNamespaceIssue(toParse);
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

  const advancedAdvancedStatement = parseStandardAdvancedCall(toParse);
  if (!advancedAdvancedStatement) {
    return false;
  }

  kernel.advancedStatements.push({
    text: advancedAdvancedStatement.text,
    anchorBundleIndex: Array.isArray(kernel.bundles) ? kernel.bundles.length : 0,
    ...(labelResult ? { label: labelResult.label } : {}),
    span: spanAt(entry.lineNo, 1, clean.length)
  });
  return true;
}

