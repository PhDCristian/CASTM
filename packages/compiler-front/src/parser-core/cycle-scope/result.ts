import type {
  ConsumeCycleScopeInput,
  ConsumeCycleScopeResult
} from './types.js';
import type { CycleScopeWorkingState } from './steps.js';

export function createCycleScopeResultFactory(
  input: ConsumeCycleScopeInput,
  state: CycleScopeWorkingState
) {
  return (
    nextIndex = input.index,
    shouldBreak = false
  ): ConsumeCycleScopeResult => ({
    nextIndex,
    currentCycle: state.currentCycle,
    shouldBreak
  });
}
