import {
  Diagnostic,
  KernelAst
} from '@openedge/compiler-ir';
import type { FunctionDefinitionLike } from './for-expand.js';
import type { SourceLineEntry } from '../parser-utils/blocks.js';

export type ExpandBodyFn = (
  body: SourceLineEntry[],
  kernel: KernelAst,
  functions: ReadonlyMap<string, FunctionDefinitionLike>,
  constants: ReadonlyMap<string, number>,
  diagnostics: Diagnostic[],
  cycleCounter: { value: number },
  callStack: string[],
  expansionCounter: { value: number },
  controlFlowCounter: { value: number }
) => void;

export interface ExpandControlBaseInput {
  body: SourceLineEntry[];
  index: number;
  entry: SourceLineEntry;
  clean: string;
  kernel: KernelAst;
  functions: ReadonlyMap<string, FunctionDefinitionLike>;
  constants: ReadonlyMap<string, number>;
  diagnostics: Diagnostic[];
  cycleCounter: { value: number };
  callStack: string[];
  expansionCounter: { value: number };
  controlFlowCounter: { value: number };
  expandBody: ExpandBodyFn;
}

export interface ExpandControlFlowResult {
  handled: boolean;
  nextIndex: number;
  shouldBreak: boolean;
}
