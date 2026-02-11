import { CycleAst, Diagnostic, KernelAst } from '@openedge/compiler-ir';
import { ErrorCodes, makeDiagnostic, spanAt } from '@openedge/compiler-ir';
import { FunctionDefinitionLike } from './for-expand.js';
import { consumeKernelControlFlowStatement } from './kernel-control-scope.js';
import { consumeKernelCycleBlockStatement } from './kernel-cycle-block-scope.js';
import { consumeKernelDirectivesStatement } from './kernel-directives-scope.js';
import { consumeKernelForStatement } from './kernel-for-scope.js';
import { consumeKernelFunctionCallStatement } from './kernel-function-call-scope.js';

export interface ConsumeKernelScopeInput {
  lines: string[];
  index: number;
  lineNo: number;
  clean: string;
  kernel: KernelAst | null;
  functions: ReadonlyMap<string, FunctionDefinitionLike>;
  kernelConstants: Map<string, number>;
  diagnostics: Diagnostic[];
  cycleIndex: number;
  functionExpansionCounter: { value: number };
  controlFlowCounter: { value: number };
}

export interface ConsumeKernelScopeResult {
  nextIndex: number;
  cycleIndex: number;
  kernelConstants: Map<string, number>;
  enterCycle: boolean;
  currentCycle: CycleAst | null;
  cycleConstants: Map<string, number>;
  shouldBreak: boolean;
}

export function consumeKernelScopeStatement(input: ConsumeKernelScopeInput): ConsumeKernelScopeResult {
  const {
    lines,
    index,
    lineNo,
    clean,
    kernel,
    functions,
    diagnostics,
    functionExpansionCounter,
    controlFlowCounter
  } = input;

  let kernelConstants = input.kernelConstants;
  let cycleIndex = input.cycleIndex;

  const noCycleResult = (nextIndex = index): ConsumeKernelScopeResult => ({
    nextIndex,
    cycleIndex,
    kernelConstants,
    enterCycle: false,
    currentCycle: null,
    cycleConstants: new Map(),
    shouldBreak: false
  });

  const breakResult = (): ConsumeKernelScopeResult => ({
    nextIndex: index,
    cycleIndex,
    kernelConstants,
    enterCycle: false,
    currentCycle: null,
    cycleConstants: new Map(),
    shouldBreak: true
  });

  const directives = consumeKernelDirectivesStatement({
    lineNo,
    clean,
    kernel,
    kernelConstants,
    diagnostics
  });
  kernelConstants = directives.kernelConstants;
  if (directives.handled) {
    return noCycleResult();
  }

  const forStatement = consumeKernelForStatement({
    lines,
    index,
    lineNo,
    clean,
    kernel,
    functions,
    kernelConstants,
    diagnostics,
    cycleIndex,
    functionExpansionCounter,
    controlFlowCounter
  });
  if (forStatement.handled) {
    cycleIndex = forStatement.cycleIndex;
    if (forStatement.shouldBreak) return breakResult();
    return noCycleResult(forStatement.nextIndex);
  }

  const cycleBlock = consumeKernelCycleBlockStatement({
    lines,
    index,
    lineNo,
    clean,
    kernel,
    kernelConstants,
    diagnostics,
    cycleIndex
  });
  if (cycleBlock.handled) {
    cycleIndex = cycleBlock.cycleIndex;
    if (cycleBlock.shouldBreak) return breakResult();
    if (cycleBlock.enterCycle) {
      return {
        nextIndex: cycleBlock.nextIndex,
        cycleIndex,
        kernelConstants,
        enterCycle: true,
        currentCycle: cycleBlock.currentCycle,
        cycleConstants: cycleBlock.cycleConstants,
        shouldBreak: false
      };
    }
    return noCycleResult(cycleBlock.nextIndex);
  }

  const functionCall = consumeKernelFunctionCallStatement({
    lineNo,
    clean,
    kernel,
    functions,
    kernelConstants,
    diagnostics,
    cycleIndex,
    functionExpansionCounter,
    controlFlowCounter
  });
  if (functionCall.handled) {
    cycleIndex = functionCall.cycleIndex;
    return noCycleResult();
  }

  const controlFlow = consumeKernelControlFlowStatement({
    lines,
    index,
    lineNo,
    clean,
    kernel,
    functions,
    kernelConstants,
    diagnostics,
    cycleIndex,
    functionExpansionCounter,
    controlFlowCounter
  });
  if (controlFlow.handled) {
    cycleIndex = controlFlow.cycleIndex;
    if (controlFlow.shouldBreak) return breakResult();
    return noCycleResult(controlFlow.nextIndex);
  }

  diagnostics.push(makeDiagnostic(
    ErrorCodes.Parse.InvalidSyntax,
    'error',
    spanAt(lineNo, 1, clean.length),
    `Unexpected kernel statement: '${clean}'`,
    'Expected config, directive, advanced statement, cycle block, if/while block, function call, or kernel close.'
  ));
  return noCycleResult();
}
