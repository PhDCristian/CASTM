import { CycleAst } from '@openedge/compiler-ir';
import { consumeKernelControlFlowStatement } from '../kernel-control-scope.js';
import { consumeKernelCycleBlockStatement } from '../kernel-cycle-block-scope.js';
import { consumeKernelDirectivesStatement } from '../kernel-directives-scope.js';
import { consumeKernelForStatement } from '../kernel-for-scope.js';
import { consumeKernelFunctionCallStatement } from '../kernel-function-call-scope.js';
import type { ConsumeKernelScopeInput } from './types.js';

export interface KernelScopeWorkingState {
  kernelConstants: Map<string, number>;
  cycleIndex: number;
}

export interface KernelScopeStepResult {
  handled: boolean;
  shouldBreak?: boolean;
  nextIndex?: number;
  enterCycle?: boolean;
  currentCycle?: CycleAst;
  cycleConstants?: Map<string, number>;
}

export function createKernelScopeWorkingState(input: ConsumeKernelScopeInput): KernelScopeWorkingState {
  return {
    kernelConstants: input.kernelConstants,
    cycleIndex: input.cycleIndex
  };
}

export function consumeKernelDirectivesStep(
  input: ConsumeKernelScopeInput,
  state: KernelScopeWorkingState
): boolean {
  const directives = consumeKernelDirectivesStatement({
    lineNo: input.lineNo,
    clean: input.clean,
    kernel: input.kernel,
    kernelConstants: state.kernelConstants,
    diagnostics: input.diagnostics
  });
  state.kernelConstants = directives.kernelConstants;
  return directives.handled;
}

export function consumeKernelForStep(
  input: ConsumeKernelScopeInput,
  state: KernelScopeWorkingState
): KernelScopeStepResult {
  const forStatement = consumeKernelForStatement({
    lines: input.lines,
    index: input.index,
    lineNo: input.lineNo,
    clean: input.clean,
    kernel: input.kernel,
    functions: input.functions,
    kernelConstants: state.kernelConstants,
    diagnostics: input.diagnostics,
    cycleIndex: state.cycleIndex,
    functionExpansionCounter: input.functionExpansionCounter,
    controlFlowCounter: input.controlFlowCounter
  });
  if (!forStatement.handled) {
    return { handled: false };
  }

  state.cycleIndex = forStatement.cycleIndex;
  return {
    handled: true,
    shouldBreak: forStatement.shouldBreak,
    nextIndex: forStatement.nextIndex
  };
}

export function consumeKernelCycleBlockStep(
  input: ConsumeKernelScopeInput,
  state: KernelScopeWorkingState
): KernelScopeStepResult {
  const cycleBlock = consumeKernelCycleBlockStatement({
    lines: input.lines,
    index: input.index,
    lineNo: input.lineNo,
    clean: input.clean,
    kernel: input.kernel,
    kernelConstants: state.kernelConstants,
    diagnostics: input.diagnostics,
    cycleIndex: state.cycleIndex
  });
  if (!cycleBlock.handled) {
    return { handled: false };
  }

  state.cycleIndex = cycleBlock.cycleIndex;
  if (cycleBlock.shouldBreak) {
    return { handled: true, shouldBreak: true };
  }

  if (!cycleBlock.enterCycle || !cycleBlock.currentCycle) {
    return {
      handled: true,
      nextIndex: cycleBlock.nextIndex
    };
  }

  return {
    handled: true,
    nextIndex: cycleBlock.nextIndex,
    enterCycle: true,
    currentCycle: cycleBlock.currentCycle,
    cycleConstants: cycleBlock.cycleConstants
  };
}

export function consumeKernelFunctionCallStep(
  input: ConsumeKernelScopeInput,
  state: KernelScopeWorkingState
): boolean {
  const functionCall = consumeKernelFunctionCallStatement({
    lineNo: input.lineNo,
    clean: input.clean,
    kernel: input.kernel,
    functions: input.functions,
    kernelConstants: state.kernelConstants,
    diagnostics: input.diagnostics,
    cycleIndex: state.cycleIndex,
    functionExpansionCounter: input.functionExpansionCounter,
    controlFlowCounter: input.controlFlowCounter
  });
  if (!functionCall.handled) {
    return false;
  }

  state.cycleIndex = functionCall.cycleIndex;
  return true;
}

export function consumeKernelControlFlowStep(
  input: ConsumeKernelScopeInput,
  state: KernelScopeWorkingState
): KernelScopeStepResult {
  const controlFlow = consumeKernelControlFlowStatement({
    lines: input.lines,
    index: input.index,
    lineNo: input.lineNo,
    clean: input.clean,
    kernel: input.kernel,
    functions: input.functions,
    kernelConstants: state.kernelConstants,
    diagnostics: input.diagnostics,
    cycleIndex: state.cycleIndex,
    functionExpansionCounter: input.functionExpansionCounter,
    controlFlowCounter: input.controlFlowCounter
  });
  if (!controlFlow.handled) {
    return { handled: false };
  }

  state.cycleIndex = controlFlow.cycleIndex;
  return {
    handled: true,
    shouldBreak: controlFlow.shouldBreak,
    nextIndex: controlFlow.nextIndex
  };
}
