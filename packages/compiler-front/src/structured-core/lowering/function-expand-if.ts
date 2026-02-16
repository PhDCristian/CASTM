import { ErrorCodes, makeDiagnostic, spanAt } from '@openedge/compiler-ir';
import {
  buildFalseBranchInstruction,
  parseControlHeader
} from './control-flow.js';
import { makeControlCycle } from './function-expand-helpers.js';
import {
  collectBlockFromEntries
} from '../parser-utils/blocks.js';
import {
  ExpandControlBaseInput,
  ExpandControlFlowResult
} from './function-expand-control-types.js';
import { resolveOptionalElseBlockInFunction } from './function-expand-if/else-resolution.js';

export function tryExpandIfStatement(input: ExpandControlBaseInput): ExpandControlFlowResult {
  const {
    body,
    index,
    entry,
    clean,
    kernel,
    functions,
    constants,
    diagnostics,
    cycleCounter,
    callStack,
    expansionCounter,
    controlFlowCounter,
    expandBody,
    expansionContext
  } = input;

  const ifHeader = parseControlHeader(clean, 'if', entry.lineNo, constants, diagnostics);
  if (!ifHeader) {
    return { handled: false, nextIndex: index, shouldBreak: false };
  }

  const thenBlock = collectBlockFromEntries(body, index);
  if (thenBlock.endIndex === null) {
    diagnostics.push(makeDiagnostic(
      ErrorCodes.Parse.InvalidSyntax,
      'error',
      spanAt(entry.lineNo, 1, clean.length),
      'Unterminated if block.',
      'Add a closing brace for if { ... }.'
    ));
    return { handled: true, nextIndex: index, shouldBreak: true };
  }

  const suffixId = controlFlowCounter.value++;
  const elseLabel = `__if_else_${suffixId}`;
  const endLabel = `__if_end_${suffixId}`;
  const resolvedElse = resolveOptionalElseBlockInFunction(body, thenBlock, entry.lineNo, clean.length, diagnostics);
  if (resolvedElse.shouldBreak) {
    return { handled: true, nextIndex: index, shouldBreak: true };
  }
  const hasElse = resolvedElse.hasElse;
  const elseBlock = resolvedElse.elseBlock;
  const consumedEnd = resolvedElse.consumedEnd;

  const falseTarget = hasElse ? elseLabel : endLabel;
  kernel.cycles.push(makeControlCycle(
    cycleCounter.value++,
    entry.lineNo,
    ifHeader.row,
    ifHeader.col,
    buildFalseBranchInstruction(ifHeader.condition, falseTarget)
  ));

  expandBody(
    thenBlock.body,
    kernel,
    functions,
    constants,
    diagnostics,
    cycleCounter,
    callStack,
    expansionCounter,
    controlFlowCounter,
    expansionContext,
    false
  );

  if (hasElse && elseBlock) {
    kernel.cycles.push(makeControlCycle(
      cycleCounter.value++,
      entry.lineNo,
      ifHeader.row,
      ifHeader.col,
      `JUMP ZERO, ${endLabel}`
    ));

    kernel.cycles.push(makeControlCycle(
      cycleCounter.value++,
      entry.lineNo,
      ifHeader.row,
      ifHeader.col,
      'NOP',
      elseLabel
    ));

    expandBody(
      elseBlock.body,
      kernel,
      functions,
      constants,
      diagnostics,
      cycleCounter,
      callStack,
      expansionCounter,
      controlFlowCounter,
      expansionContext,
      false
    );
  }

  kernel.cycles.push(makeControlCycle(
    cycleCounter.value++,
    entry.lineNo,
    ifHeader.row,
    ifHeader.col,
    'NOP',
    endLabel
  ));

  return { handled: true, nextIndex: consumedEnd, shouldBreak: false };
}
