import {
  Diagnostic,
  KernelAst
} from '@castm/compiler-ir';
import type { ForHeader } from './control-flow.js';
import type { SourceLineEntry } from '../parser-utils/blocks.js';
import {
  ExpandForCallbacks,
  FunctionDefinitionLike
} from './for-expand-types.js';
import { expandRuntimeForLoop } from './for-expand-runtime.js';
import { expandStaticForLoop } from './for-expand-static.js';
import type { FunctionExpansionContext } from './function-expand-context.js';
import type { LoopControlScope } from './loop-control-scope.js';

export type { ExpandForCallbacks, ExpandFunctionBodyIntoKernel, FunctionDefinitionLike } from './for-expand-types.js';

export function expandForLoopIntoKernel(
  header: ForHeader,
  loopLabel: string | undefined,
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
  callbacks: ExpandForCallbacks,
  expansionContext?: FunctionExpansionContext,
  loopControlStack: LoopControlScope[] = []
): void {
  if (expandRuntimeForLoop({
    header,
    loopLabel,
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
    callbacks,
    expansionContext,
    loopControlStack
  })) {
    return;
  }

  expandStaticForLoop({
    header,
    loopLabel,
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
    callbacks,
    expansionContext,
    loopControlStack
  });
}
