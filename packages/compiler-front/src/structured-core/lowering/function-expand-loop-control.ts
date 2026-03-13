import {
  ErrorCodes,
  makeDiagnostic,
  spanAt
} from '@castm/compiler-ir';
import { makeControlCycle } from './function-expand-helpers.js';
import {
  FunctionExpandStepInput,
  FunctionExpandStepResult
} from './function-expand-types.js';

function parseLoopControlLine(clean: string): { kind: 'break' | 'continue'; targetLabel?: string } | null {
  const match = clean.match(/^(break|continue)(?:\s+([A-Za-z_][A-Za-z0-9_]*))?\s*;\s*$/i);
  if (!match) return null;
  return {
    kind: match[1].toLowerCase() as 'break' | 'continue',
    ...(match[2] ? { targetLabel: match[2] } : {})
  };
}

function resolveTargetScope(
  input: FunctionExpandStepInput,
  op: 'break' | 'continue',
  targetLabel?: string
) {
  const scopes = input.loopControlStack;
  if (!targetLabel) {
    return scopes.length > 0 ? scopes[scopes.length - 1] : null;
  }

  for (let i = scopes.length - 1; i >= 0; i--) {
    if (scopes[i].label === targetLabel) {
      return scopes[i];
    }
  }

  input.diagnostics.push(makeDiagnostic(
    ErrorCodes.Semantic.InvalidLoopControl,
    'error',
    spanAt(input.entry.lineNo, 1, input.clean.length),
    `Unknown loop label '${targetLabel}' in '${op}'.`,
    'Use a loop label from an enclosing for/while statement, or remove the target label.'
  ));
  return undefined;
}

export function tryExpandLoopControlStatement(input: FunctionExpandStepInput): FunctionExpandStepResult {
  const parsed = parseLoopControlLine(input.clean);
  if (!parsed) {
    return { handled: false, nextIndex: input.index, shouldBreak: false };
  }

  const scope = resolveTargetScope(input, parsed.kind, parsed.targetLabel);
  if (scope === undefined) {
    return { handled: true, nextIndex: input.index, shouldBreak: false };
  }

  if (!scope) {
    input.diagnostics.push(makeDiagnostic(
      ErrorCodes.Semantic.InvalidLoopControl,
      'error',
      spanAt(input.entry.lineNo, 1, input.clean.length),
      `'${parsed.kind}' is only valid inside loop bodies.`,
      'Use break/continue inside while or runtime for loops.'
    ));
    return { handled: true, nextIndex: input.index, shouldBreak: false };
  }

  if (!scope.supportsBreakContinue) {
    input.diagnostics.push(makeDiagnostic(
      ErrorCodes.Semantic.InvalidLoopControl,
      'error',
      spanAt(input.entry.lineNo, 1, input.clean.length),
      `'${parsed.kind}' is not supported for static for-loop expansion in this phase.`,
      'Use break/continue in while or runtime for loops.'
    ));
    return { handled: true, nextIndex: input.index, shouldBreak: false };
  }

  const jumpTarget = parsed.kind === 'break' ? scope.breakLabel : scope.continueLabel;
  input.kernel.cycles.push(makeControlCycle(
    input.cycleCounter.value++,
    input.entry.lineNo,
    scope.row,
    scope.col,
    `JUMP ZERO, ${jumpTarget}`
  ));

  return { handled: true, nextIndex: input.index, shouldBreak: false };
}
