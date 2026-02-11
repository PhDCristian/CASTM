import { ErrorCodes, makeDiagnostic, spanAt } from '@openedge/compiler-ir';
import { parseForHeader } from '../control-flow.js';
import { parseCycleStatement } from '../statements.js';
import { expandLoopBody, expandSpatialAtBlockStatements } from '../cycle-expand.js';
import { collectBlockFromSource } from '../../parser-utils/blocks.js';
import { evaluateNumericExpression } from '../../parser-utils/numbers.js';
import type { ConsumeCycleScopeInput } from './types.js';

export interface CycleScopeWorkingState {
  currentCycle: ConsumeCycleScopeInput['currentCycle'];
}

export interface CycleScopeStepResult {
  handled: boolean;
  nextIndex?: number;
  shouldBreak?: boolean;
}

export function createCycleScopeWorkingState(input: ConsumeCycleScopeInput): CycleScopeWorkingState {
  return {
    currentCycle: input.currentCycle
  };
}

export function consumeSpatialAtBlockStep(
  input: ConsumeCycleScopeInput,
  state: CycleScopeWorkingState
): CycleScopeStepResult {
  const atBlockHeader = input.clean.match(/^at\s+@\s*([^,]+)\s*,\s*([^\{]+)\{\s*$/i);
  if (!atBlockHeader) {
    return { handled: false };
  }

  const rowExpr = atBlockHeader[1].trim();
  const colExpr = atBlockHeader[2].trim();
  const row = evaluateNumericExpression(rowExpr, input.cycleConstants, new Map());
  const col = evaluateNumericExpression(colExpr, input.cycleConstants, new Map());
  if (row === null || col === null) {
    input.diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      spanAt(input.lineNo, 1, input.clean.length),
      `Invalid spatial at-block location '@${rowExpr},${colExpr}'.`,
      'Coordinates must evaluate to integers.'
    ));
    return { handled: true };
  }

  const block = collectBlockFromSource(input.lines, input.index);
  if (block.endIndex === null) {
    input.diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      spanAt(input.lineNo, 1, input.clean.length),
      'Unterminated spatial at-block.',
      'Add a closing brace for at @row,col { ... }.'
    ));
    return { handled: true, shouldBreak: true };
  }

  state.currentCycle?.statements.push(
    ...expandSpatialAtBlockStatements(block.body, row, col, new Map(), input.diagnostics)
  );
  return {
    handled: true,
    nextIndex: block.endIndex
  };
}

export function consumeCycleForLoopStep(
  input: ConsumeCycleScopeInput,
  state: CycleScopeWorkingState
): CycleScopeStepResult {
  const loopHeader = parseForHeader(input.clean, input.lineNo, input.cycleConstants, new Map(), input.diagnostics);
  if (!loopHeader) {
    return { handled: false };
  }

  if (loopHeader.control) {
    input.diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      spanAt(input.lineNo, 1, input.clean.length),
      'Control location @row,col is not supported for for-loops inside cycle blocks.',
      'Move the loop to kernel/function scope to use runtime-control syntax.'
    ));
    return { handled: true };
  }

  if (loopHeader.runtime) {
    input.diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      spanAt(input.lineNo, 1, input.clean.length),
      'Runtime for-loops are not supported inside cycle blocks.',
      'Move the runtime loop to kernel/function scope.'
    ));
    return { handled: true };
  }

  const block = collectBlockFromSource(input.lines, input.index);
  if (block.endIndex === null) {
    input.diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      spanAt(input.lineNo, 1, input.clean.length),
      'Unterminated for loop inside cycle block.',
      'Add a closing brace for for { ... }.'
    ));
    return { handled: true, shouldBreak: true };
  }

  const shouldContinue = loopHeader.step > 0
    ? (v: number) => v < loopHeader.end
    : (v: number) => v > loopHeader.end;

  for (let value = loopHeader.start; shouldContinue(value); value += loopHeader.step) {
    const bindings = new Map<string, number>();
    bindings.set(loopHeader.variable, value);
    const expanded = expandLoopBody(block.body, input.cycleConstants, bindings, input.diagnostics);
    state.currentCycle?.statements.push(...expanded);
  }

  return {
    handled: true,
    nextIndex: block.endIndex
  };
}

export function consumeSingleCycleStatementStep(
  input: ConsumeCycleScopeInput,
  state: CycleScopeWorkingState
): CycleScopeStepResult {
  const statement = parseCycleStatement(
    input.clean,
    input.lineNo,
    input.rawLine,
    input.cycleConstants,
    new Map()
  );
  if (!statement) {
    input.diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      spanAt(input.lineNo, 1, input.clean.length),
      `Invalid cycle statement: '${input.clean}'`,
      'Expected @row,col:, at @row,col:, at @row,col { ... }, at row/col/all, or for ... in range(...) { ... }.'
    ));
    return { handled: true };
  }

  state.currentCycle?.statements.push(statement);
  return { handled: true };
}
