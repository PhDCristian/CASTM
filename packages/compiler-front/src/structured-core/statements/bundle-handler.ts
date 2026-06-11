import {
  BundleStatementAst,
  Diagnostic,
  SourceSpan,
  StructuredBundleStmtAst
} from '@castm/compiler-ir';
import {
  collectBlockFromEntries,
  SourceLineEntry
} from '../parser-utils/blocks.js';
import { expandLoopBody, parseInlineBundleStatements, parseLabeledBundleLine } from '../lowering/bundle-expand.js';
import { spanAt } from '../utils.js';

export interface StructuredBundleParseResult {
  handled: boolean;
  nextIndex: number;
  stop: boolean;
  node?: StructuredBundleStmtAst;
}

function makeBundleNode(
  lineNo: number,
  cleanLength: number,
  index: number,
  statements: BundleStatementAst[],
  label?: string,
  endLineNo = lineNo,
  endCleanLength = cleanLength
): StructuredBundleStmtAst {
  const span: SourceSpan = {
    startLine: lineNo,
    startColumn: 1,
    endLine: endLineNo,
    endColumn: Math.max(2, endCleanLength + 1)
  };
  return {
    kind: 'bundle',
    bundle: {
      index,
      statements,
      ...(label ? { label } : {}),
      span
    },
    span
  };
}

export function tryParseBundleStatement(
  entries: SourceLineEntry[],
  index: number,
  cleanLine: string,
  lineNo: number,
  bundleCounter: { value: number },
  diagnostics: Diagnostic[]
): StructuredBundleParseResult {
  // ── Labeled inline bundle: label: bundle { ... } ──
  const labeledBundle = parseLabeledBundleLine(cleanLine);
  if (labeledBundle && labeledBundle.inlinePayload !== undefined) {
    const bundleDiagnostics: Diagnostic[] = [];
    const statements = parseInlineBundleStatements(
      labeledBundle.inlinePayload,
      lineNo,
      new Map(),
      bundleDiagnostics
    );
    diagnostics.push(...bundleDiagnostics);
    return {
      handled: true,
      nextIndex: index,
      stop: false,
      node: makeBundleNode(lineNo, cleanLine.length, bundleCounter.value++, statements, labeledBundle.label)
    };
  }

  // ── Labeled block bundle: label: bundle { (multi-line) ──
  if (labeledBundle) {
    const block = collectBlockFromEntries(entries, index);
    const bundleDiagnostics: Diagnostic[] = [];
    const statements = expandLoopBody(block.body, new Map(), new Map(), bundleDiagnostics);
    diagnostics.push(...bundleDiagnostics);
    const endEntry = block.endIndex === null ? entries[index] : entries[block.endIndex];
    const node = makeBundleNode(
      lineNo,
      cleanLine.length,
      bundleCounter.value++,
      statements,
      labeledBundle.label,
      endEntry.lineNo,
      endEntry.cleanLine.length
    );
    return {
      handled: true,
      nextIndex: block.endIndex ?? index,
      stop: block.endIndex === null,
      node
    };
  }

  // ── Unlabeled inline bundle: bundle { ... } ──
  const inlineBundle = cleanLine.match(/^bundle\s*\{\s*(.+)\s*\}\s*$/i);
  if (inlineBundle) {
    const bundleDiagnostics: Diagnostic[] = [];
    const statements = parseInlineBundleStatements(
      inlineBundle[1],
      lineNo,
      new Map(),
      bundleDiagnostics
    );
    diagnostics.push(...bundleDiagnostics);
    return {
      handled: true,
      nextIndex: index,
      stop: false,
      node: makeBundleNode(lineNo, cleanLine.length, bundleCounter.value++, statements)
    };
  }

  if (!/^bundle\s*\{\s*$/i.test(cleanLine)) {
    return { handled: false, nextIndex: index, stop: false };
  }

  const block = collectBlockFromEntries(entries, index);
  const bundleDiagnostics: Diagnostic[] = [];
  const statements = expandLoopBody(block.body, new Map(), new Map(), bundleDiagnostics);
  diagnostics.push(...bundleDiagnostics);
  const endEntry = block.endIndex === null ? entries[index] : entries[block.endIndex];
  const node = makeBundleNode(
    lineNo,
    cleanLine.length,
    bundleCounter.value++,
    statements,
    undefined,
    endEntry.lineNo,
    endEntry.cleanLine.length
  );
  return {
    handled: true,
    nextIndex: block.endIndex ?? index,
    stop: block.endIndex === null,
    node
  };
}
