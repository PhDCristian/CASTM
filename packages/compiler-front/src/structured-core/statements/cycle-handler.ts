import {
  CycleStatementAst,
  Diagnostic,
  StructuredCycleStmtAst
} from '@castm/compiler-ir';
import {
  collectBlockFromEntries,
  SourceLineEntry
} from '../parser-utils/blocks.js';
import { expandLoopBody, parseInlineCycleStatements, parseLabeledCycleLine } from '../lowering/cycle-expand.js';
import { spanAt } from '../utils.js';

export interface StructuredCycleParseResult {
  handled: boolean;
  nextIndex: number;
  stop: boolean;
  node?: StructuredCycleStmtAst;
}

function makeCycleNode(
  lineNo: number,
  cleanLength: number,
  index: number,
  statements: CycleStatementAst[],
  label?: string
): StructuredCycleStmtAst {
  const span = spanAt(lineNo, cleanLength);
  return {
    kind: 'cycle',
    cycle: {
      index,
      statements,
      ...(label ? { label } : {}),
      span
    },
    span
  };
}

export function tryParseCycleStatement(
  entries: SourceLineEntry[],
  index: number,
  cleanLine: string,
  lineNo: number,
  cycleCounter: { value: number },
  diagnostics: Diagnostic[]
): StructuredCycleParseResult {
  // ── Labeled inline cycle: label: bundle { ... } ──
  const labeledCycle = parseLabeledCycleLine(cleanLine);
  if (labeledCycle && labeledCycle.inlinePayload !== undefined) {
    const cycleDiagnostics: Diagnostic[] = [];
    const statements = parseInlineCycleStatements(
      labeledCycle.inlinePayload,
      lineNo,
      new Map(),
      cycleDiagnostics
    );
    diagnostics.push(...cycleDiagnostics);
    return {
      handled: true,
      nextIndex: index,
      stop: false,
      node: makeCycleNode(lineNo, cleanLine.length, cycleCounter.value++, statements, labeledCycle.label)
    };
  }

  // ── Labeled block cycle: label: bundle { (multi-line) ──
  if (labeledCycle) {
    const block = collectBlockFromEntries(entries, index);
    const cycleDiagnostics: Diagnostic[] = [];
    const statements = expandLoopBody(block.body, new Map(), new Map(), cycleDiagnostics);
    diagnostics.push(...cycleDiagnostics);
    const node = makeCycleNode(lineNo, cleanLine.length, cycleCounter.value++, statements, labeledCycle.label);
    return {
      handled: true,
      nextIndex: block.endIndex ?? index,
      stop: block.endIndex === null,
      node
    };
  }

  // ── Unlabeled inline cycle: bundle { ... } ──
  const inlineCycle = cleanLine.match(/^(?:cycle|bundle)\s*\{\s*(.+)\s*\}\s*$/i);
  if (inlineCycle) {
    const cycleDiagnostics: Diagnostic[] = [];
    const statements = parseInlineCycleStatements(
      inlineCycle[1],
      lineNo,
      new Map(),
      cycleDiagnostics
    );
    diagnostics.push(...cycleDiagnostics);
    return {
      handled: true,
      nextIndex: index,
      stop: false,
      node: makeCycleNode(lineNo, cleanLine.length, cycleCounter.value++, statements)
    };
  }

  if (!/^(?:cycle|bundle)\s*\{\s*$/i.test(cleanLine)) {
    return { handled: false, nextIndex: index, stop: false };
  }

  const block = collectBlockFromEntries(entries, index);
  const cycleDiagnostics: Diagnostic[] = [];
  const statements = expandLoopBody(block.body, new Map(), new Map(), cycleDiagnostics);
  diagnostics.push(...cycleDiagnostics);
  const node = makeCycleNode(lineNo, cleanLine.length, cycleCounter.value++, statements);
  return {
    handled: true,
    nextIndex: block.endIndex ?? index,
    stop: block.endIndex === null,
    node
  };
}
