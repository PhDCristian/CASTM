import {
  Diagnostic,
  ErrorCodes,
  makeDiagnostic,
  StructuredKernelStmtAst
} from '@castm/compiler-ir';
import {
  SourceLineEntry
} from './parser-utils/blocks.js';
import { spanAt } from './utils.js';
import {
  parseAdvancedStatement,
  parseAdvancedNamespaceIssue,
  parsePipelineCallSequence,
  parseFunctionCall,
  shouldSkipStructuredLine
} from './statements/matchers.js';
import { tryParseBundleStatement } from './statements/bundle-handler.js';
import { tryParseControlStatement } from './statements/control-handler.js';
import { INTERPOLATED_IDENT, RESERVED_KEYWORDS } from './constants.js';

function stripLabelPrefix(clean: string): { label: string; rest: string } | null {
  const match = clean.match(new RegExp(`^(${INTERPOLATED_IDENT})\\s*:\\s*(.+)$`));
  if (!match) return null;
  const keyword = match[1].toLowerCase();
  if (RESERVED_KEYWORDS.has(keyword)) return null;
  // Don't treat std::name() as label "std" — reject if rest starts with ':'
  if (match[2].startsWith(':')) return null;
  return { label: match[1], rest: match[2] };
}

function parseLoopControlStatement(clean: string): { kind: 'break' | 'continue'; targetLabel?: string } | null {
  const match = clean.match(/^(break|continue)(?:\s+([A-Za-z_][A-Za-z0-9_]*))?\s*;\s*$/i);
  if (!match) return null;
  return {
    kind: match[1].toLowerCase() as 'break' | 'continue',
    ...(match[2] ? { targetLabel: match[2] } : {})
  };
}

export function parseStructuredStatements(
  entries: SourceLineEntry[],
  bundleCounter: { value: number },
  diagnostics: Diagnostic[]
): StructuredKernelStmtAst[] {
  const out: StructuredKernelStmtAst[] = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const clean = entry.cleanLine.trim();
    if (!clean) continue;

    if (shouldSkipStructuredLine(clean)) continue;

    const namespaceIssue = parseAdvancedNamespaceIssue(clean);
    if (namespaceIssue) {
      diagnostics.push(makeDiagnostic(
        ErrorCodes.Parse.InvalidSyntax,
        'error',
        spanAt(entry.lineNo, clean.length),
        `Unsupported advanced namespace '${namespaceIssue.namespace}::${namespaceIssue.name}(...)'.`,
        `Use std::${namespaceIssue.name}(...) for standard advanced statements.`
      ));
      continue;
    }

    const advanced = parseAdvancedStatement(clean);
    if (advanced) {
      out.push({
        kind: 'advanced',
        name: advanced.name,
        args: advanced.args,
        text: advanced.text,
        namespace: advanced.namespace,
        sourceForm: advanced.sourceForm,
        span: spanAt(entry.lineNo, clean.length)
      });
      continue;
    }

    const pipelineCalls = parsePipelineCallSequence(clean);
    if (pipelineCalls !== undefined) {
      if (!pipelineCalls || pipelineCalls.length === 0) {
        diagnostics.push(makeDiagnostic(
          ErrorCodes.Parse.InvalidSyntax,
          'error',
          spanAt(entry.lineNo, clean.length),
          `Invalid pipeline statement: '${clean}'.`,
          'Use pipeline(fn1(...), fn2(...), ...); with canonical function calls only.'
        ));
        continue;
      }

      for (const call of pipelineCalls) {
        out.push({
          kind: 'fn-call',
          name: call.name,
          args: call.args,
          span: spanAt(entry.lineNo, clean.length)
        });
      }
      continue;
    }

    const bundleResult = tryParseBundleStatement(entries, i, clean, entry.lineNo, bundleCounter, diagnostics);
    if (bundleResult.handled) {
      if (bundleResult.node) out.push(bundleResult.node);
      if (bundleResult.stop) break;
      i = bundleResult.nextIndex;
      continue;
    }

    const controlResult = tryParseControlStatement(
      entries,
      i,
      clean,
      entry.lineNo,
      bundleCounter,
      diagnostics,
      parseStructuredStatements
    );
    if (controlResult.handled) {
      if (controlResult.node) out.push(controlResult.node);
      if (controlResult.stop) break;
      i = controlResult.nextIndex;
      continue;
    }

    const loopControl = parseLoopControlStatement(clean);
    if (loopControl) {
      out.push({
        ...loopControl,
        span: spanAt(entry.lineNo, clean.length)
      });
      continue;
    }

    const fnCall = parseFunctionCall(clean);
    if (fnCall) {
      out.push({
        ...fnCall,
        span: spanAt(entry.lineNo, clean.length)
      });
      continue;
    }

    // ── Labeled advanced statement or function call ──
    const labeled = stripLabelPrefix(clean);
    if (labeled) {
      const controlLabeled = tryParseControlStatement(
        entries,
        i,
        labeled.rest,
        entry.lineNo,
        bundleCounter,
        diagnostics,
        parseStructuredStatements,
        labeled.label
      );
      if (controlLabeled.handled) {
        if (controlLabeled.node) out.push(controlLabeled.node);
        if (controlLabeled.stop) break;
        i = controlLabeled.nextIndex;
        continue;
      }

      const advLabeled = parseAdvancedStatement(labeled.rest);
      if (advLabeled) {
        out.push({
          kind: 'advanced',
          name: advLabeled.name,
          args: advLabeled.args,
          text: advLabeled.text,
          namespace: advLabeled.namespace,
          sourceForm: advLabeled.sourceForm,
          label: labeled.label,
          span: spanAt(entry.lineNo, clean.length)
        });
        continue;
      }
      const fnLabeled = parseFunctionCall(labeled.rest);
      if (fnLabeled) {
        out.push({
          ...fnLabeled,
          label: labeled.label,
          span: spanAt(entry.lineNo, clean.length)
        });
        continue;
      }
    }

    diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      spanAt(entry.lineNo, clean.length),
      `Unrecognized kernel statement: '${clean}'.`,
      'Use canonical statements (bundle, at, for, if, while, std::route/std::reduce/std::scan/std::broadcast/...).'
    ));
  }

  return out;
}
