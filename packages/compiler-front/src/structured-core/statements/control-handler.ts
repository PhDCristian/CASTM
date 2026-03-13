import {
  Diagnostic,
  ErrorCodes,
  StructuredIfStmtAst,
  StructuredKernelStmtAst,
  StructuredWhileStmtAst,
  makeDiagnostic
} from '@castm/compiler-ir';
import {
  collectBlockAfterOpenFromEntries,
  collectBlockFromEntries,
  SourceLineEntry
} from '../parser-utils/blocks.js';
import { isElseOpenLine, parseInteger, spanAt } from '../utils.js';

export interface StructuredControlParseResult {
  handled: boolean;
  nextIndex: number;
  stop: boolean;
  node?: StructuredKernelStmtAst;
}

function skipMalformedControlRegion(
  entries: SourceLineEntry[],
  index: number,
  cleanLine: string
): Pick<StructuredControlParseResult, 'nextIndex' | 'stop'> {
  if (!cleanLine.includes('{')) {
    return { nextIndex: index, stop: false };
  }
  const block = collectBlockFromEntries(entries, index);
  if (block.endIndex === null) {
    return { nextIndex: index, stop: true };
  }
  return { nextIndex: block.endIndex, stop: false };
}

export function tryParseControlStatement(
  entries: SourceLineEntry[],
  index: number,
  cleanLine: string,
  lineNo: number,
  cycleCounter: { value: number },
  diagnostics: Diagnostic[],
  parseNestedStatements: (
    entries: SourceLineEntry[],
    cycleCounter: { value: number },
    diagnostics: Diagnostic[]
  ) => StructuredKernelStmtAst[],
  label?: string
): StructuredControlParseResult {
  const forHeader = cleanLine.match(
    /^for\s+([A-Za-z_][A-Za-z0-9_]*)\s+in\s+range\s*\(([^)]*)\)\s*(?:at\s+@\s*([^,\{\s]+)\s*,\s*([^\{\s]+))?\s*(?:runtime\s*)?(?:(?:unroll|collapse)\s*\([^)]*\)\s*)*\{\s*$/i
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
        ...(label ? { label } : {}),
        body: parseNestedStatements(block.body, cycleCounter, diagnostics),
        span: spanAt(lineNo, cleanLine.length)
      }
    };
  }

  if (/^for\b/i.test(cleanLine)) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      spanAt(lineNo, cleanLine.length),
      `Invalid for-loop header '${cleanLine}'.`,
      'Use: for i in range(...) { ... } or for R0 in range(...) at @row,col runtime { ... }.'
    ));
    const malformed = skipMalformedControlRegion(entries, index, cleanLine);
    return { handled: true, nextIndex: malformed.nextIndex, stop: malformed.stop };
  }

  const ifHeader = cleanLine.match(/^if\s*\((.+)\)\s*at\s+@\s*([^,]+)\s*,\s*([^\{]+)\{\s*$/i);
  if (!ifHeader && /^if\s*\(/i.test(cleanLine)) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      spanAt(lineNo, cleanLine.length),
      `Invalid if header '${cleanLine}'.`,
      'Use: if (cond) at @row,col { ... } with explicit control location.'
    ));
    const malformed = skipMalformedControlRegion(entries, index, cleanLine);
    return { handled: true, nextIndex: malformed.nextIndex, stop: malformed.stop };
  }
  if (ifHeader) {
    const thenBlock = collectBlockFromEntries(entries, index);
    if (thenBlock.endIndex === null) {
      return { handled: true, nextIndex: index, stop: true };
    }

    const parsedRow = parseInteger(ifHeader[2]);
    const parsedCol = parseInteger(ifHeader[3]);
    if (parsedRow === null || parsedCol === null) {
      diagnostics.push(makeDiagnostic(
        ErrorCodes.Parse.InvalidSyntax,
        'error',
        spanAt(lineNo, cleanLine.length),
        `Invalid if control location '@${ifHeader[2].trim()},${ifHeader[3].trim()}'.`,
        'Control coordinates must be integer literals (decimal or hex).'
      ));
    }
    const row = parsedRow ?? 0;
    const col = parsedCol ?? 0;
    const thenBody = parseNestedStatements(thenBlock.body, cycleCounter, diagnostics);
    let elseBody: StructuredKernelStmtAst[] | undefined;
    let consumedEnd = thenBlock.endIndex;

    if (thenBlock.trailingAfterClose && isElseOpenLine(thenBlock.trailingAfterClose)) {
      const parsedElse = collectBlockAfterOpenFromEntries(entries, thenBlock.endIndex + 1);
      if (parsedElse.endIndex !== null) {
        elseBody = parseNestedStatements(parsedElse.body, cycleCounter, diagnostics);
        consumedEnd = parsedElse.endIndex;
      }
    } else {
      const maybeElse = thenBlock.endIndex + 1;
      if (maybeElse < entries.length && isElseOpenLine(entries[maybeElse].cleanLine)) {
        const parsedElse = collectBlockFromEntries(entries, maybeElse);
        if (parsedElse.endIndex !== null) {
          elseBody = parseNestedStatements(parsedElse.body, cycleCounter, diagnostics);
          consumedEnd = parsedElse.endIndex;
        }
      }
    }

    const ifNode: StructuredIfStmtAst = {
      kind: 'if',
      condition: ifHeader[1].trim(),
      control: { row, col },
      ...(label ? { label } : {}),
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
  if (!whileHeader && /^while\s*\(/i.test(cleanLine)) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      spanAt(lineNo, cleanLine.length),
      `Invalid while header '${cleanLine}'.`,
      'Use: while (cond) at @row,col { ... } with explicit control location.'
    ));
    const malformed = skipMalformedControlRegion(entries, index, cleanLine);
    return { handled: true, nextIndex: malformed.nextIndex, stop: malformed.stop };
  }
  if (!whileHeader) {
    return { handled: false, nextIndex: index, stop: false };
  }

  const block = collectBlockFromEntries(entries, index);
  if (block.endIndex === null) {
    return { handled: true, nextIndex: index, stop: true };
  }
  const parsedRow = parseInteger(whileHeader[2]);
  const parsedCol = parseInteger(whileHeader[3]);
  if (parsedRow === null || parsedCol === null) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      spanAt(lineNo, cleanLine.length),
      `Invalid while control location '@${whileHeader[2].trim()},${whileHeader[3].trim()}'.`,
      'Control coordinates must be integer literals (decimal or hex).'
    ));
  }
  const row = parsedRow ?? 0;
  const col = parsedCol ?? 0;
  const whileNode: StructuredWhileStmtAst = {
    kind: 'while',
    condition: whileHeader[1].trim(),
    control: { row, col },
    ...(label ? { label } : {}),
    body: parseNestedStatements(block.body, cycleCounter, diagnostics),
    span: spanAt(lineNo, cleanLine.length)
  };

  return {
    handled: true,
    nextIndex: block.endIndex,
    stop: false,
    node: whileNode
  };
}
