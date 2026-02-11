import { ErrorCodes, makeDiagnostic, spanAt } from '@openedge/compiler-ir';
import { buildFalseBranchInstruction, parseControlHeader } from './control-flow.js';
import {
  expandFunctionBodyIntoKernel,
  makeControlCycle
} from './function-expand.js';
import { isElseOpenLine } from './cycle-expand.js';
import {
  CollectedBlock,
  collectBlockAfterOpenFromSource,
  collectBlockFromSource
} from '../parser-utils/blocks.js';
import { stripLineComment } from '../parser-utils/strings.js';
import {
  ConsumeKernelControlFlowInput,
  ConsumeKernelControlFlowResult
} from './kernel-control-flow-types.js';

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

  let hasElse = false;
  let elseBlock: CollectedBlock | null = null;
  let consumedEnd = thenBlock.endIndex;

  if (thenBlock.trailingAfterClose && isElseOpenLine(thenBlock.trailingAfterClose)) {
    hasElse = true;
    elseBlock = collectBlockAfterOpenFromSource(lines, thenBlock.endIndex + 1);
    if (elseBlock.endIndex === null) {
      diagnostics.push(makeDiagnostic(
        ErrorCodes.Parse.InvalidSyntax,
        'error',
        spanAt(lineNo, 1, clean.length),
        'Unterminated else block.',
        'Add a closing brace for else { ... }.'
      ));
      return { handled: true, nextIndex: index, cycleIndex, shouldBreak: true };
    }
    consumedEnd = elseBlock.endIndex;
  } else {
    const maybeElseIndex = thenBlock.endIndex + 1;
    if (maybeElseIndex < lines.length && isElseOpenLine(stripLineComment(lines[maybeElseIndex]).trim())) {
      hasElse = true;
      elseBlock = collectBlockFromSource(lines, maybeElseIndex);
      if (elseBlock.endIndex === null) {
        diagnostics.push(makeDiagnostic(
          ErrorCodes.Parse.InvalidSyntax,
          'error',
          spanAt(maybeElseIndex + 1, 1, clean.length),
          'Unterminated else block.',
          'Add a closing brace for else { ... }.'
        ));
        return { handled: true, nextIndex: index, cycleIndex, shouldBreak: true };
      }
      consumedEnd = elseBlock.endIndex;
    }
  }

  const falseTarget = hasElse ? elseLabel : endLabel;
  kernel.cycles.push(makeControlCycle(
    cycleIndex++,
    lineNo,
    ifHeader.row,
    ifHeader.col,
    buildFalseBranchInstruction(ifHeader.condition, falseTarget)
  ));

  {
    const cycleCounter = { value: cycleIndex };
    expandFunctionBodyIntoKernel(
      thenBlock.body,
      kernel,
      functions,
      kernelConstants,
      diagnostics,
      cycleCounter,
      [],
      functionExpansionCounter,
      controlFlowCounter
    );
    cycleIndex = cycleCounter.value;
  }

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

    const cycleCounter = { value: cycleIndex };
    expandFunctionBodyIntoKernel(
      elseBlock.body,
      kernel,
      functions,
      kernelConstants,
      diagnostics,
      cycleCounter,
      [],
      functionExpansionCounter,
      controlFlowCounter
    );
    cycleIndex = cycleCounter.value;
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
