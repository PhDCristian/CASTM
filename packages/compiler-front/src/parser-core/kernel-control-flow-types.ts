import { Diagnostic, KernelAst } from '@openedge/compiler-ir';
import type { FunctionDefinitionLike } from './for-expand.js';

export interface ConsumeKernelControlFlowInput {
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

export interface ConsumeKernelControlFlowResult {
  handled: boolean;
  nextIndex: number;
  cycleIndex: number;
  shouldBreak: boolean;
}
