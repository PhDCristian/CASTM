import {
  AstProgram,
  Diagnostic
} from '@openedge/compiler-ir';
import { consumeCycleScopeStatement } from '../cycle-scope.js';
import { consumeKernelScopeStatement } from '../kernel-scope.js';
import { consumeTopLevelScopeStatement } from '../top-level-scope.js';
import { ParserState } from '../parse-state.js';
import type { ParseLineResult } from './types.js';

export function consumeTopLevelParserLine(
  lines: string[],
  index: number,
  lineNo: number,
  clean: string,
  ast: AstProgram,
  state: ParserState,
  diagnostics: Diagnostic[]
): ParseLineResult {
  const consumed = consumeTopLevelScopeStatement({
    lines,
    index,
    lineNo,
    clean,
    ast,
    kernel: state.kernel,
    kernelConstants: state.kernelConstants,
    pendingDirectives: state.pendingDirectives,
    functions: state.functions,
    diagnostics
  });

  state.kernel = consumed.kernel;
  state.kernelConstants = consumed.kernelConstants;
  state.inKernel = consumed.inKernel;
  return { nextIndex: consumed.nextIndex, shouldBreak: consumed.shouldBreak };
}

export function consumeKernelParserLine(
  lines: string[],
  index: number,
  lineNo: number,
  clean: string,
  state: ParserState,
  diagnostics: Diagnostic[]
): ParseLineResult {
  if (clean === '}') {
    state.inKernel = false;
    return { nextIndex: index, shouldBreak: false };
  }

  const consumed = consumeKernelScopeStatement({
    lines,
    index,
    lineNo,
    clean,
    kernel: state.kernel,
    functions: state.functions,
    kernelConstants: state.kernelConstants,
    diagnostics,
    cycleIndex: state.cycleIndex,
    functionExpansionCounter: state.functionExpansionCounter,
    controlFlowCounter: state.controlFlowCounter
  });

  state.kernelConstants = consumed.kernelConstants;
  state.cycleIndex = consumed.cycleIndex;
  if (consumed.enterCycle) {
    state.inCycle = true;
    state.currentCycle = consumed.currentCycle;
    state.cycleConstants = consumed.cycleConstants;
  }
  return { nextIndex: consumed.nextIndex, shouldBreak: consumed.shouldBreak };
}

export function consumeCycleParserLine(
  lines: string[],
  index: number,
  lineNo: number,
  rawLine: string,
  clean: string,
  state: ParserState,
  diagnostics: Diagnostic[]
): ParseLineResult {
  if (clean === '}') {
    if (state.kernel && state.currentCycle) {
      state.kernel.cycles.push(state.currentCycle);
    }
    state.currentCycle = null;
    state.inCycle = false;
    return { nextIndex: index, shouldBreak: false };
  }

  const consumed = consumeCycleScopeStatement({
    lines,
    index,
    lineNo,
    rawLine,
    clean,
    cycleConstants: state.cycleConstants,
    diagnostics,
    currentCycle: state.currentCycle
  });
  state.currentCycle = consumed.currentCycle;
  return { nextIndex: consumed.nextIndex, shouldBreak: consumed.shouldBreak };
}
