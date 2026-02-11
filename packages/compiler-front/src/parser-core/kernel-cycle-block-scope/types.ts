import { CycleAst, Diagnostic, KernelAst } from '@openedge/compiler-ir';

export interface ConsumeKernelCycleBlockInput {
  lines: string[];
  index: number;
  lineNo: number;
  clean: string;
  kernel: KernelAst | null;
  kernelConstants: Map<string, number>;
  diagnostics: Diagnostic[];
  cycleIndex: number;
}

export interface ConsumeKernelCycleBlockResult {
  handled: boolean;
  nextIndex: number;
  cycleIndex: number;
  enterCycle: boolean;
  currentCycle: CycleAst | null;
  cycleConstants: Map<string, number>;
  shouldBreak: boolean;
}
