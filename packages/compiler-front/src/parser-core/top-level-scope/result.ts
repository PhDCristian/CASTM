import type {
  ConsumeTopLevelScopeInput,
  ConsumeTopLevelScopeResult
} from './types.js';
import type { TopLevelScopeWorkingState } from './steps.js';

export function createTopLevelScopeResultFactory(
  input: ConsumeTopLevelScopeInput,
  state: TopLevelScopeWorkingState
) {
  return (
    nextIndex = input.index,
    inKernel = false,
    shouldBreak = false
  ): ConsumeTopLevelScopeResult => ({
    nextIndex,
    kernel: state.kernel,
    kernelConstants: state.kernelConstants,
    pendingDirectives: state.pendingDirectives,
    functions: state.functions,
    inKernel,
    shouldBreak
  });
}
