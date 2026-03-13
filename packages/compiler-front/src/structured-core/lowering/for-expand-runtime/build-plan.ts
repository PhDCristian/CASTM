import {
  KernelAst,
  spanAt
} from '@castm/compiler-ir';
import { buildRuntimeNoUnrollAggressivePlan } from '../for-expand-helpers.js';
import {
  ExpandRuntimeForInput,
  RuntimeLoopPlan
} from './types.js';

export function buildRuntimeLoopPlan(input: ExpandRuntimeForInput): RuntimeLoopPlan {
  const {
    header,
    loopBody,
    lineNo,
    lineLength,
    functions,
    constants,
    diagnostics,
    callStack,
    expansionCounter,
    controlFlowCounter,
    callbacks,
    expansionContext
  } = input;

  const controlRow = header.control?.row ?? 0;
  const controlCol = header.control?.col ?? 0;
  const suffix = controlFlowCounter.value++;
  const startLabel = `__for_start_${suffix}`;
  const continueLabel = `__for_continue_${suffix}`;
  const endLabel = `__for_end_${suffix}`;

  const loopKernel: KernelAst = {
    name: '__for_runtime_body__',
    config: undefined,
    cycles: [],
    directives: [],
    pragmas: [],
    span: spanAt(lineNo, 1, lineLength)
  };
  const loopCounter = { value: 0 };
  callbacks.expandFunctionBodyIntoKernel(
    loopBody,
    loopKernel,
    functions,
    constants,
    diagnostics,
    loopCounter,
    callStack,
    expansionCounter,
    controlFlowCounter,
    expansionContext,
    false,
    [
      ...(input.loopControlStack ?? []),
      {
        kind: 'for-runtime',
        label: input.loopLabel,
        breakLabel: endLabel,
        continueLabel,
        row: controlRow,
        col: controlCol,
        supportsBreakContinue: true
      }
    ]
  );

  const aggressivePlan = buildRuntimeNoUnrollAggressivePlan(
    loopKernel.cycles,
    header.variable,
    controlRow,
    controlCol,
    callbacks.cycleHasControlFlow,
    callbacks.parseInstruction
  );

  return {
    controlRow,
    controlCol,
    startLabel,
    continueLabel,
    endLabel,
    loopKernel,
    aggressivePlan
  };
}
