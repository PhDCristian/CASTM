import {
  Diagnostic,
  KernelAst
} from '@openedge/compiler-ir';
import type { ForHeader } from '../control-flow.js';
import type { SourceLineEntry } from '../../parser-utils/blocks.js';
import type { ExpandForCallbacks, FunctionDefinitionLike } from '../for-expand-types.js';
import type { RuntimeNoUnrollAggressivePlan } from '../for-expand-helpers.js';

export interface ExpandRuntimeForInput {
  header: ForHeader;
  loopBody: SourceLineEntry[];
  lineNo: number;
  lineLength: number;
  kernel: KernelAst;
  functions: ReadonlyMap<string, FunctionDefinitionLike>;
  constants: ReadonlyMap<string, number>;
  diagnostics: Diagnostic[];
  cycleCounter: { value: number };
  callStack: string[];
  expansionCounter: { value: number };
  controlFlowCounter: { value: number };
  callbacks: ExpandForCallbacks;
}

export interface RuntimeLoopPlan {
  controlRow: number;
  controlCol: number;
  startLabel: string;
  endLabel: string;
  loopKernel: KernelAst;
  aggressivePlan: RuntimeNoUnrollAggressivePlan | null;
}
