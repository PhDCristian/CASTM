import { Diagnostic, KernelAst } from '@openedge/compiler-ir';
import { expandFunctionBodyIntoKernel } from './function-expand.js';
import type { FunctionDefinitionLike } from './for-expand.js';
import type { SourceLineEntry } from '../parser-utils/blocks.js';

export function expandControlBodyIntoKernel(
  body: SourceLineEntry[],
  kernel: KernelAst,
  functions: ReadonlyMap<string, FunctionDefinitionLike>,
  kernelConstants: ReadonlyMap<string, number>,
  diagnostics: Diagnostic[],
  cycleIndex: number,
  functionExpansionCounter: { value: number },
  controlFlowCounter: { value: number }
): number {
  const cycleCounter = { value: cycleIndex };
  expandFunctionBodyIntoKernel(
    body,
    kernel,
    functions,
    kernelConstants,
    diagnostics,
    cycleCounter,
    [],
    functionExpansionCounter,
    controlFlowCounter
  );
  return cycleCounter.value;
}
