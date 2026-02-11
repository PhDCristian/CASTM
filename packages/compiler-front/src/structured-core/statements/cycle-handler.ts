import {
  StructuredCycleStmtAst
} from '@openedge/compiler-ir';
import {
  collectBlockFromEntries,
  SourceLineEntry
} from '../../parser-utils/blocks.js';
import { spanAt } from '../utils.js';

export interface StructuredCycleParseResult {
  handled: boolean;
  nextIndex: number;
  stop: boolean;
  node?: StructuredCycleStmtAst;
}

function makePlaceholderCycle(lineNo: number, cleanLength: number, index: number): StructuredCycleStmtAst {
  const span = spanAt(lineNo, cleanLength);
  return {
    kind: 'cycle',
    cycle: {
      index,
      statements: [],
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
  cycleCounter: { value: number }
): StructuredCycleParseResult {
  const inlineCycle = cleanLine.match(/^cycle\s*\{\s*(.+)\s*\}\s*$/i);
  if (inlineCycle) {
    return {
      handled: true,
      nextIndex: index,
      stop: false,
      node: makePlaceholderCycle(lineNo, cleanLine.length, cycleCounter.value++)
    };
  }

  if (!/^cycle\s*\{\s*$/i.test(cleanLine)) {
    return { handled: false, nextIndex: index, stop: false };
  }

  const block = collectBlockFromEntries(entries, index);
  const node = makePlaceholderCycle(lineNo, cleanLine.length, cycleCounter.value++);
  return {
    handled: true,
    nextIndex: block.endIndex ?? index,
    stop: block.endIndex === null,
    node
  };
}
