import {
  Diagnostic,
  KernelAst
} from '@castm/compiler-ir';
import type { FunctionDefinitionLike } from './for-expand.js';
import type { SourceLineEntry } from '../parser-utils/blocks.js';
import type { FunctionExpansionContext } from './function-expand-context.js';
import type { LoopControlScope } from './loop-control-scope.js';

export type ExpandBodyFn = (
  body: SourceLineEntry[],
  kernel: KernelAst,
  functions: ReadonlyMap<string, FunctionDefinitionLike>,
  constants: ReadonlyMap<string, number>,
  diagnostics: Diagnostic[],
  cycleCounter: { value: number },
  callStack: string[],
  expansionCounter: { value: number },
  controlFlowCounter: { value: number },
  expansionContext?: FunctionExpansionContext,
  isRoot?: boolean,
  loopControlStack?: LoopControlScope[]
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
  expansionContext?: FunctionExpansionContext;
  loopControlStack: LoopControlScope[];
}

export interface ExpandControlFlowResult {
  handled: boolean;
  nextIndex: number;
  shouldBreak: boolean;
}
