import {
  Diagnostic,
  KernelAst
} from '@openedge/compiler-ir';
import { SourceLineEntry } from '../parser-utils/blocks.js';
import { FunctionDefinitionLike } from './for-expand.js';
import type { FunctionExpansionContext } from './function-expand-context.js';

export interface FunctionExpandStepInput {
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
  expandBody: (
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
    isRoot?: boolean
  ) => void;
  expansionContext?: FunctionExpansionContext;
}

export interface FunctionExpandStepResult {
  handled: boolean;
  nextIndex: number;
  shouldBreak: boolean;
}
