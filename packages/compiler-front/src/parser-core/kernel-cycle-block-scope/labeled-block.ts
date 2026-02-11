import { Diagnostic } from '@openedge/compiler-ir';
import { ErrorCodes, makeDiagnostic, spanAt } from '@openedge/compiler-ir';
import { expandLoopBody } from '../cycle-expand.js';
import { collectBlockFromSource } from '../../parser-utils/blocks.js';
import {
  ConsumeKernelCycleBlockResult
} from './types.js';
import type { KernelAst } from '@openedge/compiler-ir';

export function tryConsumeLabeledCycleBlock(
  lines: string[],
  index: number,
  lineNo: number,
  clean: string,
  cycleIndex: number,
  label: string,
  kernel: KernelAst | null,
  kernelConstants: Map<string, number>,
  diagnostics: Diagnostic[]
): ConsumeKernelCycleBlockResult | null {
  if (!kernel) return null;

  const block = collectBlockFromSource(lines, index);
  if (block.endIndex === null) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      spanAt(lineNo, 1, clean.length),
      `Unterminated labeled cycle '${label}'.`,
      'Add a closing brace for cycle { ... }.'
    ));
    return {
      handled: true,
      nextIndex: index,
      cycleIndex,
      enterCycle: false,
      currentCycle: null,
      cycleConstants: new Map(),
      shouldBreak: true
    };
  }

  kernel.cycles.push({
    index: cycleIndex,
    label,
    statements: expandLoopBody(block.body, kernelConstants, new Map(), diagnostics),
    span: spanAt(lineNo, 1, clean.length)
  });
  return {
    handled: true,
    nextIndex: block.endIndex,
    cycleIndex: cycleIndex + 1,
    enterCycle: false,
    currentCycle: null,
    cycleConstants: new Map(),
    shouldBreak: false
  };
}
