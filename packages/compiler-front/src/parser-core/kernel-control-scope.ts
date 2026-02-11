export type {
  ConsumeKernelControlFlowInput,
  ConsumeKernelControlFlowResult
} from './kernel-control-flow-types.js';

import {
  ConsumeKernelControlFlowInput,
  ConsumeKernelControlFlowResult
} from './kernel-control-flow-types.js';
import { consumeKernelIfControlFlowStatement } from './kernel-control-if.js';
import { consumeKernelWhileControlFlowStatement } from './kernel-control-while.js';

export function consumeKernelControlFlowStatement(
  input: ConsumeKernelControlFlowInput
): ConsumeKernelControlFlowResult {
  const ifResult = consumeKernelIfControlFlowStatement(input);
  if (ifResult.handled) {
    return ifResult;
  }

  const whileResult = consumeKernelWhileControlFlowStatement(input);
  if (whileResult.handled) {
    return whileResult;
  }

  return {
    handled: false,
    nextIndex: input.index,
    cycleIndex: input.cycleIndex,
    shouldBreak: false
  };
}
