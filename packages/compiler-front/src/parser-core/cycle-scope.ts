import { CycleAst, Diagnostic } from '@openedge/compiler-ir';
import { ErrorCodes, makeDiagnostic, spanAt } from '@openedge/compiler-ir';
import { parseForHeader } from './control-flow.js';
import { parseCycleStatement } from './statements.js';
import { expandLoopBody, expandSpatialAtBlockStatements } from './cycle-expand.js';
import { collectBlockFromSource } from '../parser-utils/blocks.js';
import { evaluateNumericExpression } from '../parser-utils/numbers.js';

export interface ConsumeCycleScopeInput {
  lines: string[];
  index: number;
  lineNo: number;
  rawLine: string;
  clean: string;
  cycleConstants: ReadonlyMap<string, number>;
  diagnostics: Diagnostic[];
  currentCycle: CycleAst | null;
}

export interface ConsumeCycleScopeResult {
  nextIndex: number;
  currentCycle: CycleAst | null;
  shouldBreak: boolean;
}

export function consumeCycleScopeStatement(input: ConsumeCycleScopeInput): ConsumeCycleScopeResult {
  const {
    lines,
    index,
    lineNo,
    rawLine,
    clean,
    cycleConstants,
    diagnostics,
    currentCycle
  } = input;

  const atBlockHeader = clean.match(/^at\s+@\s*([^,]+)\s*,\s*([^\{]+)\{\s*$/i);
  if (atBlockHeader) {
    const row = evaluateNumericExpression(atBlockHeader[1].trim(), cycleConstants, new Map());
    const col = evaluateNumericExpression(atBlockHeader[2].trim(), cycleConstants, new Map());
    if (row === null || col === null) {
      diagnostics.push(makeDiagnostic(
        ErrorCodes.Parse.InvalidSyntax,
        'error',
        spanAt(lineNo, 1, clean.length),
        `Invalid spatial at-block location '@${atBlockHeader[1].trim()},${atBlockHeader[2].trim()}'.`,
        'Coordinates must evaluate to integers.'
      ));
      return { nextIndex: index, currentCycle, shouldBreak: false };
    }

    const block = collectBlockFromSource(lines, index);
    if (block.endIndex === null) {
      diagnostics.push(makeDiagnostic(
        ErrorCodes.Parse.InvalidSyntax,
        'error',
        spanAt(lineNo, 1, clean.length),
        'Unterminated spatial at-block.',
        'Add a closing brace for at @row,col { ... }.'
      ));
      return { nextIndex: index, currentCycle, shouldBreak: true };
    }

    currentCycle?.statements.push(
      ...expandSpatialAtBlockStatements(block.body, row, col, new Map(), diagnostics)
    );

    return { nextIndex: block.endIndex, currentCycle, shouldBreak: false };
  }

  const loopHeader = parseForHeader(clean, lineNo, cycleConstants, new Map(), diagnostics);
  if (loopHeader) {
    if (loopHeader.control) {
      diagnostics.push(makeDiagnostic(
        ErrorCodes.Parse.InvalidSyntax,
        'error',
        spanAt(lineNo, 1, clean.length),
        'Control location @row,col is not supported for for-loops inside cycle blocks.',
        'Move the loop to kernel/function scope to use runtime-control syntax.'
      ));
      return { nextIndex: index, currentCycle, shouldBreak: false };
    }

    if (loopHeader.runtime) {
      diagnostics.push(makeDiagnostic(
        ErrorCodes.Parse.InvalidSyntax,
        'error',
        spanAt(lineNo, 1, clean.length),
        'Runtime for-loops are not supported inside cycle blocks.',
        'Move the runtime loop to kernel/function scope.'
      ));
      return { nextIndex: index, currentCycle, shouldBreak: false };
    }

    const block = collectBlockFromSource(lines, index);
    if (block.endIndex === null) {
      diagnostics.push(makeDiagnostic(
        ErrorCodes.Parse.InvalidSyntax,
        'error',
        spanAt(lineNo, 1, clean.length),
        'Unterminated for loop inside cycle block.',
        'Add a closing brace for for { ... }.'
      ));
      return { nextIndex: index, currentCycle, shouldBreak: true };
    }

    const shouldContinue = loopHeader.step > 0
      ? (v: number) => v < loopHeader.end
      : (v: number) => v > loopHeader.end;

    for (let value = loopHeader.start; shouldContinue(value); value += loopHeader.step) {
      const bindings = new Map<string, number>();
      bindings.set(loopHeader.variable, value);
      const expanded = expandLoopBody(block.body, cycleConstants, bindings, diagnostics);
      currentCycle?.statements.push(...expanded);
    }

    return { nextIndex: block.endIndex, currentCycle, shouldBreak: false };
  }

  const statement = parseCycleStatement(clean, lineNo, rawLine, cycleConstants, new Map());
  if (!statement) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      spanAt(lineNo, 1, clean.length),
      `Invalid cycle statement: '${clean}'`,
      'Expected @row,col:, at @row,col:, at @row,col { ... }, at row/col/all, or for ... in range(...) { ... }.'
    ));
    return { nextIndex: index, currentCycle, shouldBreak: false };
  }

  currentCycle?.statements.push(statement);
  return { nextIndex: index, currentCycle, shouldBreak: false };
}
