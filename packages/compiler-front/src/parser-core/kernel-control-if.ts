import { ErrorCodes, makeDiagnostic, spanAt } from '@openedge/compiler-ir';
import { buildFalseBranchInstruction, parseControlHeader } from './control-flow.js';
import {
  makeControlCycle
} from './function-expand.js';
import {
  collectBlockFromSource
} from '../parser-utils/blocks.js';
import {
  ConsumeKernelControlFlowInput,
  ConsumeKernelControlFlowResult
} from './kernel-control-flow-types.js';
import { resolveOptionalElseBlock } from './kernel-control-if/else-resolution.js';
import { expandControlBodyIntoKernel } from './kernel-control-utils.js';

export function consumeKernelIfControlFlowStatement(
  input: ConsumeKernelControlFlowInput
): ConsumeKernelControlFlowResult {
  const {
    lines,
    index,
    lineNo,
    clean,
    kernel,
    functions,
    kernelConstants,
    diagnostics,
    functionExpansionCounter,
    controlFlowCounter
  } = input;
  let cycleIndex = input.cycleIndex;

  const ifHeader = parseControlHeader(clean, 'if', lineNo, kernelConstants, diagnostics);
  if (!(ifHeader && kernel)) {
    return { handled: false, nextIndex: index, cycleIndex, shouldBreak: false };
  }

  const thenBlock = collectBlockFromSource(lines, index);
  if (thenBlock.endIndex === null) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      spanAt(lineNo, 1, clean.length),
      'Unterminated if block.',
      'Add a closing brace for if { ... }.'
    ));
    return { handled: true, nextIndex: index, cycleIndex, shouldBreak: true };
  }

  const suffixId = controlFlowCounter.value++;
  const elseLabel = `__if_else_${suffixId}`;
  const endLabel = `__if_end_${suffixId}`;
  const resolvedElse = resolveOptionalElseBlock(lines, thenBlock, lineNo, clean.length, diagnostics);
  if (resolvedElse.shouldBreak) {
    return { handled: true, nextIndex: index, cycleIndex, shouldBreak: true };
  }
  const hasElse = resolvedElse.hasElse;
  const elseBlock = resolvedElse.elseBlock;
  const consumedEnd = resolvedElse.consumedEnd;

  const falseTarget = hasElse ? elseLabel : endLabel;
  kernel.cycles.push(makeControlCycle(
    cycleIndex++,
    lineNo,
    ifHeader.row,
    ifHeader.col,
    buildFalseBranchInstruction(ifHeader.condition, falseTarget)
  ));

  cycleIndex = expandControlBodyIntoKernel(
    thenBlock.body,
    kernel,
    functions,
    kernelConstants,
    diagnostics,
    cycleIndex,
    functionExpansionCounter,
    controlFlowCounter
  );

  if (hasElse && elseBlock) {
    kernel.cycles.push(makeControlCycle(
      cycleIndex++,
      lineNo,
      ifHeader.row,
      ifHeader.col,
      `JUMP ${endLabel}, ZERO`
    ));

    kernel.cycles.push(makeControlCycle(
      cycleIndex++,
      lineNo,
      ifHeader.row,
      ifHeader.col,
      'NOP',
      elseLabel
    ));

    cycleIndex = expandControlBodyIntoKernel(
      elseBlock.body,
      kernel,
      functions,
      kernelConstants,
      diagnostics,
      cycleIndex,
      functionExpansionCounter,
      controlFlowCounter
    );
  }

  kernel.cycles.push(makeControlCycle(
    cycleIndex++,
    lineNo,
    ifHeader.row,
    ifHeader.col,
    'NOP',
    endLabel
  ));

  return { handled: true, nextIndex: consumedEnd, cycleIndex, shouldBreak: false };
}
