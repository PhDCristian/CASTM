import {
  AstProgram,
  Diagnostic,
  ParseResult,
  SourceSpan
} from '@openedge/compiler-ir';
import { consumeParserLine } from './parser-core/parse-line.js';
import {
  createInitialParserState,
  finalizeParserState
} from './parser-core/parse-state.js';
import { stripLineComment } from './parser-utils/strings.js';

export function parseSource(source: string): ParseResult {
  const diagnostics: Diagnostic[] = [];
  const lines = source.split(/\r?\n/);

  const span: SourceSpan = {
    startLine: 1,
    startColumn: 1,
    endLine: lines.length,
    endColumn: (lines[lines.length - 1] || '').length + 1
  };

  const ast: AstProgram = {
    targetProfileId: null,
    kernel: null,
    span
  };

  const state = createInitialParserState();

  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    const rawLine = lines[i];
    const clean = stripLineComment(rawLine).trim();

    if (!clean) continue;

    const consumed = consumeParserLine(lines, i, lineNo, rawLine, clean, ast, state, diagnostics);
    if (consumed.shouldBreak) break;
    i = consumed.nextIndex;
  }

  finalizeParserState(ast, lines, state, diagnostics);

  return {
    success: diagnostics.every((d) => d.severity !== 'error'),
    ast,
    diagnostics
  };
}
