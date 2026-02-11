import { Diagnostic, KernelAst } from '@openedge/compiler-ir';
import { ErrorCodes, makeDiagnostic, spanAt } from '@openedge/compiler-ir';
import { parseForHeader } from './control-flow.js';
import { expandForLoopIntoKernel, FunctionDefinitionLike } from './for-expand.js';
import {
  cloneCycle,
  cycleHasControlFlow,
  expandFunctionBodyIntoKernel,
  makeControlCycle
} from './function-expand.js';
import { parseInstruction } from './instructions.js';
import { collectBlockFromSource } from '../parser-utils/blocks.js';

export interface ConsumeKernelForInput {
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

export interface ConsumeKernelForResult {
  handled: boolean;
  nextIndex: number;
  cycleIndex: number;
  shouldBreak: boolean;
}

export function consumeKernelForStatement(input: ConsumeKernelForInput): ConsumeKernelForResult {
  const {
    lines,
    index,
    lineNo,
    clean,
    kernel,
    functions,
    kernelConstants,
    diagnostics,
    functionExpansionCounter,
    controlFlowCounter
  } = input;
  let cycleIndex = input.cycleIndex;

  const forHeader = parseForHeader(clean, lineNo, kernelConstants, new Map(), diagnostics);
  if (!forHeader || !kernel) {
    return { handled: false, nextIndex: index, cycleIndex, shouldBreak: false };
  }

  const loopBlock = collectBlockFromSource(lines, index);
  if (loopBlock.endIndex === null) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      spanAt(lineNo, 1, clean.length),
      'Unterminated for block.',
      'Add a closing brace for for { ... }.'
    ));
    return { handled: true, nextIndex: index, cycleIndex, shouldBreak: true };
  }

  const cycleCounter = { value: cycleIndex };
  expandForLoopIntoKernel(
    forHeader,
    loopBlock.body,
    lineNo,
    clean.length,
    kernel,
    functions,
    kernelConstants,
    diagnostics,
    cycleCounter,
    [],
    functionExpansionCounter,
    controlFlowCounter,
    {
      cycleHasControlFlow,
      cloneCycle,
      parseInstruction,
      makeControlCycle,
      expandFunctionBodyIntoKernel
    }
  );
  cycleIndex = cycleCounter.value;

  return {
    handled: true,
    nextIndex: loopBlock.endIndex,
    cycleIndex,
    shouldBreak: false
  };
}
