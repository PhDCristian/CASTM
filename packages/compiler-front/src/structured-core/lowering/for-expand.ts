import {
  Diagnostic,
  KernelAst
} from '@openedge/compiler-ir';
import type { ForHeader } from './control-flow.js';
import type { SourceLineEntry } from '../parser-utils/blocks.js';
import {
  ExpandForCallbacks,
  FunctionDefinitionLike
} from './for-expand-types.js';
import { expandRuntimeForLoop } from './for-expand-runtime.js';
import { expandStaticForLoop } from './for-expand-static.js';

export type { ExpandForCallbacks, ExpandFunctionBodyIntoKernel, FunctionDefinitionLike } from './for-expand-types.js';

export function expandForLoopIntoKernel(
  header: ForHeader,
  loopBody: SourceLineEntry[],
  lineNo: number,
  lineLength: number,
  kernel: KernelAst,
  functions: ReadonlyMap<string, FunctionDefinitionLike>,
  constants: ReadonlyMap<string, number>,
  diagnostics: Diagnostic[],
  cycleCounter: { value: number },
  callStack: string[],
  expansionCounter: { value: number },
  controlFlowCounter: { value: number },
  callbacks: ExpandForCallbacks
): void {
  if (expandRuntimeForLoop({
    header,
    loopBody,
    lineNo,
    lineLength,
    kernel,
    functions,
    constants,
    diagnostics,
    cycleCounter,
    callStack,
    expansionCounter,
    controlFlowCounter,
    callbacks
  })) {
    return;
  }

  expandStaticForLoop({
    header,
    loopBody,
    lineNo,
    lineLength,
    kernel,
    functions,
    constants,
    diagnostics,
    cycleCounter,
    callStack,
    expansionCounter,
    controlFlowCounter,
    callbacks
  });
}
