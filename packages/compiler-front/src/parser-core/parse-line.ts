import {
  AstProgram,
  Diagnostic
} from '@openedge/compiler-ir';
import { ParserState } from './parse-state.js';
import {
  consumeCycleParserLine,
  consumeKernelParserLine,
  consumeTopLevelParserLine
} from './parse-line/modes.js';
import type { ParseLineResult } from './parse-line/types.js';

export function consumeParserLine(
  lines: string[],
  index: number,
  lineNo: number,
  rawLine: string,
  clean: string,
  ast: AstProgram,
  state: ParserState,
  diagnostics: Diagnostic[]
): ParseLineResult {
  if (!state.inKernel) {
    return consumeTopLevelParserLine(lines, index, lineNo, clean, ast, state, diagnostics);
  }

  if (state.inKernel && !state.inCycle) {
    return consumeKernelParserLine(lines, index, lineNo, clean, state, diagnostics);
  }

  return consumeCycleParserLine(lines, index, lineNo, rawLine, clean, state, diagnostics);
}
