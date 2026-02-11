import type {
  ConsumeKernelScopeInput,
  ConsumeKernelScopeResult
} from './types.js';
import type { KernelScopeWorkingState } from './steps.js';
import type { CycleAst } from '@openedge/compiler-ir';

export function createKernelScopeResultFactory(
  input: ConsumeKernelScopeInput,
  state: KernelScopeWorkingState
) {
  const noCycle = (nextIndex = input.index, shouldBreak = false): ConsumeKernelScopeResult => ({
    nextIndex,
    cycleIndex: state.cycleIndex,
    kernelConstants: state.kernelConstants,
    enterCycle: false,
    currentCycle: null,
    cycleConstants: new Map(),
    shouldBreak
  });

  const enterCycle = (
    nextIndex: number,
    currentCycle: CycleAst,
    cycleConstants: Map<string, number>
  ): ConsumeKernelScopeResult => ({
    nextIndex,
    cycleIndex: state.cycleIndex,
    kernelConstants: state.kernelConstants,
    enterCycle: true,
    currentCycle,
    cycleConstants,
    shouldBreak: false
  });

  return { noCycle, enterCycle };
}
