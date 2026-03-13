import {
  Diagnostic,
  KernelAst
} from '@castm/compiler-ir';
import type { ForHeader } from '../control-flow.js';
import type { SourceLineEntry } from '../../parser-utils/blocks.js';
import type { ExpandForCallbacks, FunctionDefinitionLike } from '../for-expand-types.js';
import type { RuntimeNoUnrollAggressivePlan } from '../for-expand-helpers.js';
import type { FunctionExpansionContext } from '../function-expand-context.js';
import type { LoopControlScope } from '../loop-control-scope.js';

export interface ExpandRuntimeForInput {
  header: ForHeader;
  loopLabel?: string;
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
  expansionContext?: FunctionExpansionContext;
  loopControlStack?: LoopControlScope[];
}

export interface RuntimeLoopPlan {
  controlRow: number;
  controlCol: number;
  startLabel: string;
  continueLabel: string;
  endLabel: string;
  loopKernel: KernelAst;
  aggressivePlan: RuntimeNoUnrollAggressivePlan | null;
}
