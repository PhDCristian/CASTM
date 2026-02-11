import {
  StructuredCycleStmtAst,
  StructuredFnCallStmtAst,
  StructuredIfStmtAst,
  StructuredKernelStmtAst,
  StructuredWhileStmtAst
} from '@openedge/compiler-ir';
import {
  collectBlockAfterOpenFromEntries,
  collectBlockFromEntries,
  SourceLineEntry
} from '../parser-utils/blocks.js';
import { splitTopLevel } from '../parser-utils/strings.js';
import { ADVANCED_NAMES, RESERVED_KEYWORDS } from './constants.js';
import { isElseOpenLine, parseInteger, spanAt } from './utils.js';

function parseAdvancedStatement(cleanLine: string): string | null {
  const match = cleanLine.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*\((.+)\)\s*;?\s*$/);
  if (!match) return null;
  const name = match[1].toLowerCase();
  if (!ADVANCED_NAMES.has(name)) return null;
  return `${name}(${match[2].trim()})`;
}

function parseFunctionCall(cleanLine: string): StructuredFnCallStmtAst | null {
  const match = cleanLine.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*\((.*)\)\s*;?\s*$/);
  if (!match) return null;

  const name = match[1];
  const lower = name.toLowerCase();
  if (RESERVED_KEYWORDS.has(lower) || ADVANCED_NAMES.has(lower)) return null;

  const argsText = match[2].trim();
  const args = argsText.length === 0 ? [] : splitTopLevel(argsText, ',');

  return {
    kind: 'fn-call',
    name,
    args,
    span: spanAt(1, cleanLine.length)
  };
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

export function parseStructuredStatements(
  entries: SourceLineEntry[],
  cycleCounter: { value: number }
): StructuredKernelStmtAst[] {
  const out: StructuredKernelStmtAst[] = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const clean = entry.cleanLine.trim();
    if (!clean) continue;

    if (/^config\s*\(/i.test(clean)) continue;
    if (/^let\s+/i.test(clean)) continue;
    if (/^\.(io_load|io_store|limit|assert)\b/i.test(clean)) continue;

    const advanced = parseAdvancedStatement(clean);
    if (advanced) {
      out.push({
        kind: 'advanced',
        text: advanced,
        span: spanAt(entry.lineNo, clean.length)
      });
      continue;
    }

    const inlineCycle = clean.match(/^cycle\s*\{\s*(.+)\s*\}\s*$/i);
    if (inlineCycle) {
      out.push(makePlaceholderCycle(entry.lineNo, clean.length, cycleCounter.value++));
      continue;
    }

    if (/^cycle\s*\{\s*$/i.test(clean)) {
      const block = collectBlockFromEntries(entries, i);
      out.push(makePlaceholderCycle(entry.lineNo, clean.length, cycleCounter.value++));
      if (block.endIndex === null) break;
      i = block.endIndex;
      continue;
    }

    const forHeader = clean.match(
      /^for\s+([A-Za-z_][A-Za-z0-9_]*)\s+in\s+range\s*\((.*)\)\s*(?:at\s+@\s*([^,\{\s]+)\s*,\s*([^\{\s]+))?\s*(runtime)?\s*\{\s*$/i
    );
    if (forHeader) {
      const block = collectBlockFromEntries(entries, i);
      if (block.endIndex === null) break;
      out.push({
        kind: 'for',
        header: clean.slice(0, clean.lastIndexOf('{')).trim(),
        body: parseStructuredStatements(block.body, cycleCounter),
        span: spanAt(entry.lineNo, clean.length)
      });
      i = block.endIndex;
      continue;
    }

    const ifHeader = clean.match(/^if\s*\((.+)\)\s*at\s+@\s*([^,]+)\s*,\s*([^\{]+)\{\s*$/i);
    if (ifHeader) {
      const thenBlock = collectBlockFromEntries(entries, i);
      if (thenBlock.endIndex === null) break;

      const row = parseInteger(ifHeader[2]) ?? 0;
      const col = parseInteger(ifHeader[3]) ?? 0;
      const thenBody = parseStructuredStatements(thenBlock.body, cycleCounter);
      let elseBody: StructuredKernelStmtAst[] | undefined;
      let consumedEnd = thenBlock.endIndex;

      if (thenBlock.trailingAfterClose && isElseOpenLine(thenBlock.trailingAfterClose)) {
        const parsedElse = collectBlockAfterOpenFromEntries(entries, thenBlock.endIndex + 1);
        if (parsedElse.endIndex !== null) {
          elseBody = parseStructuredStatements(parsedElse.body, cycleCounter);
          consumedEnd = parsedElse.endIndex;
        }
      } else {
        const maybeElse = thenBlock.endIndex + 1;
        if (maybeElse < entries.length && isElseOpenLine(entries[maybeElse].cleanLine)) {
          const parsedElse = collectBlockFromEntries(entries, maybeElse);
          if (parsedElse.endIndex !== null) {
            elseBody = parseStructuredStatements(parsedElse.body, cycleCounter);
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
        span: spanAt(entry.lineNo, clean.length)
      };
      out.push(ifNode);
      i = consumedEnd;
      continue;
    }

    const whileHeader = clean.match(/^while\s*\((.+)\)\s*at\s+@\s*([^,]+)\s*,\s*([^\{]+)\{\s*$/i);
    if (whileHeader) {
      const block = collectBlockFromEntries(entries, i);
      if (block.endIndex === null) break;
      const row = parseInteger(whileHeader[2]) ?? 0;
      const col = parseInteger(whileHeader[3]) ?? 0;
      const whileNode: StructuredWhileStmtAst = {
        kind: 'while',
        condition: whileHeader[1].trim(),
        control: { row, col },
        body: parseStructuredStatements(block.body, cycleCounter),
        span: spanAt(entry.lineNo, clean.length)
      };
      out.push(whileNode);
      i = block.endIndex;
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
  }

  return out;
}
