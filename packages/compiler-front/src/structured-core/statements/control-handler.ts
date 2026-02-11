import {
  StructuredIfStmtAst,
  StructuredKernelStmtAst,
  StructuredWhileStmtAst
} from '@openedge/compiler-ir';
import {
  collectBlockAfterOpenFromEntries,
  collectBlockFromEntries,
  SourceLineEntry
} from '../../parser-utils/blocks.js';
import { isElseOpenLine, parseInteger, spanAt } from '../utils.js';

export interface StructuredControlParseResult {
  handled: boolean;
  nextIndex: number;
  stop: boolean;
  node?: StructuredKernelStmtAst;
}

export function tryParseControlStatement(
  entries: SourceLineEntry[],
  index: number,
  cleanLine: string,
  lineNo: number,
  cycleCounter: { value: number },
  parseNestedStatements: (entries: SourceLineEntry[], cycleCounter: { value: number }) => StructuredKernelStmtAst[]
): StructuredControlParseResult {
  const forHeader = cleanLine.match(
    /^for\s+([A-Za-z_][A-Za-z0-9_]*)\s+in\s+range\s*\((.*)\)\s*(?:at\s+@\s*([^,\{\s]+)\s*,\s*([^\{\s]+))?\s*(runtime)?\s*\{\s*$/i
  );
  if (forHeader) {
    const block = collectBlockFromEntries(entries, index);
    if (block.endIndex === null) {
      return { handled: true, nextIndex: index, stop: true };
    }
    return {
      handled: true,
      nextIndex: block.endIndex,
      stop: false,
      node: {
        kind: 'for',
        header: cleanLine.slice(0, cleanLine.lastIndexOf('{')).trim(),
        body: parseNestedStatements(block.body, cycleCounter),
        span: spanAt(lineNo, cleanLine.length)
      }
    };
  }

  const ifHeader = cleanLine.match(/^if\s*\((.+)\)\s*at\s+@\s*([^,]+)\s*,\s*([^\{]+)\{\s*$/i);
  if (ifHeader) {
    const thenBlock = collectBlockFromEntries(entries, index);
    if (thenBlock.endIndex === null) {
      return { handled: true, nextIndex: index, stop: true };
    }

    const row = parseInteger(ifHeader[2]) ?? 0;
    const col = parseInteger(ifHeader[3]) ?? 0;
    const thenBody = parseNestedStatements(thenBlock.body, cycleCounter);
    let elseBody: StructuredKernelStmtAst[] | undefined;
    let consumedEnd = thenBlock.endIndex;

    if (thenBlock.trailingAfterClose && isElseOpenLine(thenBlock.trailingAfterClose)) {
      const parsedElse = collectBlockAfterOpenFromEntries(entries, thenBlock.endIndex + 1);
      if (parsedElse.endIndex !== null) {
        elseBody = parseNestedStatements(parsedElse.body, cycleCounter);
        consumedEnd = parsedElse.endIndex;
      }
    } else {
      const maybeElse = thenBlock.endIndex + 1;
      if (maybeElse < entries.length && isElseOpenLine(entries[maybeElse].cleanLine)) {
        const parsedElse = collectBlockFromEntries(entries, maybeElse);
        if (parsedElse.endIndex !== null) {
          elseBody = parseNestedStatements(parsedElse.body, cycleCounter);
          consumedEnd = parsedElse.endIndex;
        }
      }
    }

    const ifNode: StructuredIfStmtAst = {
      kind: 'if',
      condition: ifHeader[1].trim(),
      control: { row, col },
      thenBody,
      ...(elseBody ? { elseBody } : {}),
      span: spanAt(lineNo, cleanLine.length)
    };
    return {
      handled: true,
      nextIndex: consumedEnd,
      stop: false,
      node: ifNode
    };
  }

  const whileHeader = cleanLine.match(/^while\s*\((.+)\)\s*at\s+@\s*([^,]+)\s*,\s*([^\{]+)\{\s*$/i);
  if (!whileHeader) {
    return { handled: false, nextIndex: index, stop: false };
  }

  const block = collectBlockFromEntries(entries, index);
  if (block.endIndex === null) {
    return { handled: true, nextIndex: index, stop: true };
  }
  const row = parseInteger(whileHeader[2]) ?? 0;
  const col = parseInteger(whileHeader[3]) ?? 0;
  const whileNode: StructuredWhileStmtAst = {
    kind: 'while',
    condition: whileHeader[1].trim(),
    control: { row, col },
    body: parseNestedStatements(block.body, cycleCounter),
    span: spanAt(lineNo, cleanLine.length)
  };

  return {
    handled: true,
    nextIndex: block.endIndex,
    stop: false,
    node: whileNode
  };
}
