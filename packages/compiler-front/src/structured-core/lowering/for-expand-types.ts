import {
  CycleAst,
  Diagnostic,
  InstructionAst,
  KernelAst,
  SourceSpan
} from '@castm/compiler-ir';
import type { SourceLineEntry } from '../parser-utils/blocks.js';
import type { FunctionExpansionContext } from './function-expand-context.js';
import type { LoopControlScope } from './loop-control-scope.js';

export interface FunctionDefinitionLike {
  name: string;
  params: string[];
  body: SourceLineEntry[];
  span: SourceSpan;
  isMacro?: boolean;
}

export type ExpandFunctionBodyIntoKernel = (
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

export interface ExpandForCallbacks {
  cycleHasControlFlow: (cycle: CycleAst) => boolean;
  cloneCycle: (cycle: CycleAst, index: number) => CycleAst;
  parseInstruction: (text: string, line: number, column: number) => InstructionAst;
  makeControlCycle: (
    index: number,
    lineNo: number,
    row: number,
    col: number,
    instructionText: string,
    label?: string
  ) => CycleAst;
  expandFunctionBodyIntoKernel: ExpandFunctionBodyIntoKernel;
}
