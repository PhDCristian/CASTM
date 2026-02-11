import {
  CycleStatementAst,
  Diagnostic,
  StructuredCycleStmtAst
} from '@openedge/compiler-ir';
import {
  collectBlockFromEntries,
  SourceLineEntry
} from '../../parser-utils/blocks.js';
import { expandLoopBody, parseInlineCycleStatements } from '../../parser-core/cycle-expand.js';
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
  statements: CycleStatementAst[]
): StructuredCycleStmtAst {
  const span = spanAt(lineNo, cleanLength);
  return {
    kind: 'cycle',
    cycle: {
      index,
      statements,
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
  const inlineCycle = cleanLine.match(/^cycle\s*\{\s*(.+)\s*\}\s*$/i);
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

  if (!/^cycle\s*\{\s*$/i.test(cleanLine)) {
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
