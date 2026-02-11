import { CycleAst, Diagnostic, KernelAst } from '@openedge/compiler-ir';
import { FunctionDefinitionLike } from '../for-expand.js';

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
