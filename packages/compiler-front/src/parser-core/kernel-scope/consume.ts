import { ErrorCodes, makeDiagnostic, spanAt } from '@openedge/compiler-ir';
import {
  ConsumeKernelScopeInput,
  ConsumeKernelScopeResult
} from './types.js';
import { createKernelScopeResultFactory } from './result.js';
import {
  consumeKernelControlFlowStep,
  consumeKernelCycleBlockStep,
  consumeKernelDirectivesStep,
  consumeKernelForStep,
  consumeKernelFunctionCallStep,
  createKernelScopeWorkingState
} from './steps.js';

export function consumeKernelScopeStatement(input: ConsumeKernelScopeInput): ConsumeKernelScopeResult {
  const state = createKernelScopeWorkingState(input);
  const result = createKernelScopeResultFactory(input, state);

  if (consumeKernelDirectivesStep(input, state)) {
    return result.noCycle();
  }

  const forStep = consumeKernelForStep(input, state);
  if (forStep.handled) {
    if (forStep.shouldBreak) return result.noCycle(input.index, true);
    return result.noCycle(forStep.nextIndex);
  }

  const cycleStep = consumeKernelCycleBlockStep(input, state);
  if (cycleStep.handled) {
    if (cycleStep.shouldBreak) return result.noCycle(input.index, true);
    if (cycleStep.enterCycle && cycleStep.currentCycle && cycleStep.cycleConstants) {
      return result.enterCycle(cycleStep.nextIndex ?? input.index, cycleStep.currentCycle, cycleStep.cycleConstants);
    }
    return result.noCycle(cycleStep.nextIndex);
  }

  if (consumeKernelFunctionCallStep(input, state)) {
    return result.noCycle();
  }

  const controlStep = consumeKernelControlFlowStep(input, state);
  if (controlStep.handled) {
    if (controlStep.shouldBreak) return result.noCycle(input.index, true);
    return result.noCycle(controlStep.nextIndex);
  }

  input.diagnostics.push(makeDiagnostic(
    ErrorCodes.Parse.InvalidSyntax,
    'error',
    spanAt(input.lineNo, 1, input.clean.length),
    `Unexpected kernel statement: '${input.clean}'`,
    'Expected config, directive, advanced statement, cycle block, if/while block, function call, or kernel close.'
  ));
  return result.noCycle();
}
