import {
  CycleStatementAst,
  Diagnostic,
  ErrorCodes,
  makeDiagnostic,
  spanAt
} from '@castm/compiler-ir';
import { parseForHeader } from '../control-flow.js';
import { parseCycleStatement } from '../statements.js';
import { collectBlockFromEntries, SourceLineEntry } from '../../parser-utils/blocks.js';
import { evaluateNumericExpression } from '../../parser-utils/numbers.js';
import { splitTopLevel } from '../../parser-utils/strings.js';
import { expandSpatialAtBlockStatements } from '../cycle-spatial.js';

export interface ExpandLoopEntryInput {
  body: SourceLineEntry[];
  index: number;
  entry: SourceLineEntry;
  clean: string;
  raw: string;
  constants: ReadonlyMap<string, number>;
  bindings: ReadonlyMap<string, number>;
  diagnostics: Diagnostic[];
}

export interface ExpandLoopEntryResult {
  handled: boolean;
  nextIndex: number;
  shouldBreak: boolean;
  statements: CycleStatementAst[];
}

export type ExpandLoopBodyFn = (
  body: SourceLineEntry[],
  constants: ReadonlyMap<string, number>,
  bindings: ReadonlyMap<string, number>,
  diagnostics: Diagnostic[]
) => CycleStatementAst[];

export function tryExpandNestedForLoopStep(
  input: ExpandLoopEntryInput,
  expandNestedBody: ExpandLoopBodyFn
): ExpandLoopEntryResult {
  const loopHeader = parseForHeader(
    input.clean,
    input.entry.lineNo,
    input.constants,
    input.bindings,
    input.diagnostics
  );
  if (!loopHeader) {
    return { handled: false, nextIndex: input.index, shouldBreak: false, statements: [] };
  }

  if (loopHeader.control) {
    input.diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      spanAt(input.entry.lineNo, 1, input.clean.length),
      'Control location @row,col is not supported for for-loops inside cycle blocks.',
      'Move the loop to kernel/function scope to use runtime-control syntax.'
    ));
    return { handled: true, nextIndex: input.index, shouldBreak: false, statements: [] };
  }

  if (loopHeader.runtime) {
    input.diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      spanAt(input.entry.lineNo, 1, input.clean.length),
      'Runtime for-loops are not supported inside cycle blocks.',
      'Move the runtime loop to kernel/function scope.'
    ));
    return { handled: true, nextIndex: input.index, shouldBreak: false, statements: [] };
  }

  if ((loopHeader.collapseLevels ?? 1) > 1) {
    input.diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      spanAt(input.entry.lineNo, 1, input.clean.length),
      'collapse(n) is not supported for for-loops inside cycle blocks.',
      'Use collapse(n) at kernel/function scope where loops expand into cycles.'
    ));
    return { handled: true, nextIndex: input.index, shouldBreak: false, statements: [] };
  }

  if (loopHeader.unrollFactor !== undefined) {
    input.diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      spanAt(input.entry.lineNo, 1, input.clean.length),
      'unroll(k) is not supported for for-loops inside cycle blocks.',
      'Use unroll(k) at kernel/function scope where loops expand into cycles.'
    ));
    return { handled: true, nextIndex: input.index, shouldBreak: false, statements: [] };
  }

  const nested = collectBlockFromEntries(input.body, input.index);
  if (nested.endIndex === null) {
    input.diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      spanAt(input.entry.lineNo, 1, input.clean.length),
      'Unterminated for loop inside cycle block.',
      'Add a closing brace for for { ... }.'
    ));
    return { handled: true, nextIndex: input.index, shouldBreak: true, statements: [] };
  }

  const statements: CycleStatementAst[] = [];
  const shouldContinue = loopHeader.step > 0
    ? (v: number) => v < loopHeader.end
    : (v: number) => v > loopHeader.end;

  for (let value = loopHeader.start; shouldContinue(value); value += loopHeader.step) {
    const nestedBindings = new Map(input.bindings);
    nestedBindings.set(loopHeader.variable, value);
    statements.push(...expandNestedBody(nested.body, input.constants, nestedBindings, input.diagnostics));
  }

  return { handled: true, nextIndex: nested.endIndex, shouldBreak: false, statements };
}

export function tryExpandSpatialAtBlockStep(input: ExpandLoopEntryInput): ExpandLoopEntryResult {
  const atBlockHeader = input.clean.match(/^at\s+@\s*([^,]+)\s*,\s*([^\{]+)\{\s*$/i);
  if (!atBlockHeader) {
    return { handled: false, nextIndex: input.index, shouldBreak: false, statements: [] };
  }

  const rowExpr = atBlockHeader[1].trim();
  const colExpr = atBlockHeader[2].trim();
  const row = evaluateNumericExpression(rowExpr, input.constants, input.bindings);
  const col = evaluateNumericExpression(colExpr, input.constants, input.bindings);
  if (row === null || col === null) {
    input.diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      spanAt(input.entry.lineNo, 1, input.clean.length),
      `Invalid spatial at-block location '@${rowExpr},${colExpr}'.`,
      'Coordinates must evaluate to integers.'
    ));
    return { handled: true, nextIndex: input.index, shouldBreak: false, statements: [] };
  }

  const nested = collectBlockFromEntries(input.body, input.index);
  if (nested.endIndex === null) {
    input.diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      spanAt(input.entry.lineNo, 1, input.clean.length),
      'Unterminated spatial at-block.',
      'Add a closing brace for at @row,col { ... }.'
    ));
    return { handled: true, nextIndex: input.index, shouldBreak: true, statements: [] };
  }

  const statements = expandSpatialAtBlockStatements(
    nested.body,
    row,
    col,
    input.bindings,
    input.diagnostics
  );
  return { handled: true, nextIndex: nested.endIndex, shouldBreak: false, statements };
}

export function tryExpandSingleCycleStatementStep(input: ExpandLoopEntryInput): ExpandLoopEntryResult {
  if (input.clean === '}') {
    input.diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      spanAt(input.entry.lineNo, 1, input.clean.length),
      'Unexpected closing brace inside cycle block.',
      'Check for mismatched braces around for/cycle blocks.'
    ));
    return { handled: true, nextIndex: input.index, shouldBreak: false, statements: [] };
  }

  const statements: CycleStatementAst[] = [];
  const parts = splitTopLevel(input.clean, ';').map((part) => part.trim()).filter(Boolean);
  const candidates = parts.length > 1 ? parts.map((part) => `${part};`) : [input.clean];

  for (const candidate of candidates) {
    const parsedStatements = parseCycleStatement(
      candidate,
      input.entry.lineNo,
      input.raw,
      input.constants,
      input.bindings
    );
    if (!parsedStatements || parsedStatements.length === 0) {
      const visible = candidate.endsWith(';') ? candidate.slice(0, -1) : candidate;
      input.diagnostics.push(makeDiagnostic(
        ErrorCodes.Parse.InvalidSyntax,
        'error',
        spanAt(input.entry.lineNo, 1, Math.max(1, visible.length)),
        `Invalid cycle statement: '${visible}'`,
        'Expected @row,col:, at @row,col:, at @row,col { ... }, at row/col/all, or for ... in range(...) { ... }.'
      ));
      continue;
    }
    statements.push(...parsedStatements);
  }

  return { handled: true, nextIndex: input.index, shouldBreak: false, statements };
}
