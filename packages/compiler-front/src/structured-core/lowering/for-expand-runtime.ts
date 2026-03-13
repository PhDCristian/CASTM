import {
  ErrorCodes,
  makeDiagnostic,
  spanAt
} from '@castm/compiler-ir';
import { buildRuntimeLoopPlan } from './for-expand-runtime/build-plan.js';
import { emitRuntimeLoopCycles } from './for-expand-runtime/emit.js';
import type { ExpandRuntimeForInput } from './for-expand-runtime/types.js';

export function expandRuntimeForLoop(input: ExpandRuntimeForInput): boolean {
  const {
    header,
    lineNo,
    lineLength,
    diagnostics
  } = input;

  if (header.runtime !== true) return false;

  if (!/^R\d+$/i.test(header.variable)) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      spanAt(lineNo, 1, lineLength),
      `Runtime for-loop requires a register loop variable, got '${header.variable}'.`,
      'Use for R0 in range(...) at @r,c runtime { ... }, for R1..., etc.'
    ));
    return true;
  }

  const plan = buildRuntimeLoopPlan(input);
  emitRuntimeLoopCycles(input, plan);
  return true;
}
